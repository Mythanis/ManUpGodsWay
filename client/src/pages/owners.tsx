import { useState } from "react";
import type { User } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Crown, Settings, Users, Database, Shield, Activity, Trash2, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Owners() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState(null);

  // Fetch all users with enhanced data
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users?limit=1000', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    }
  });

  // Fetch system statistics
  const { data: stats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  // Role update mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role })
      });
      if (!response.ok) throw new Error('Failed to update role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Success", description: "User role updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user role", variant: "destructive" });
    }
  });

  // System maintenance functions
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      // Clear all query cache
      queryClient.clear();
      return { success: true };
    },
    onSuccess: () => {
      toast({ title: "Success", description: "System cache cleared successfully" });
    }
  });

  const roleColors = {
    owner: 'bg-purple-600 text-white',
    admin: 'bg-blue-600 text-white',
    user: 'bg-gray-600 text-white'
  };

  const tierColors = {
    vip: 'bg-gold text-black',
    premium: 'bg-yellow-600 text-white', 
    free: 'bg-gray-400 text-white'
  };

  if (usersLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Crown className="h-8 w-8 text-gold" />
          <div>
            <h1 className="text-3xl font-bold text-white">Owner Dashboard</h1>
            <p className="text-gray-400">Enhanced system administration and management</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-gray-900 border border-gray-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gold data-[state=active]:text-black">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-gold data-[state=active]:text-black">
              <Users className="h-4 w-4 mr-2" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-gold data-[state=active]:text-black">
              <Database className="h-4 w-4 mr-2" />
              System Control
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-gold data-[state=active]:text-black">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-gold" />
                    User Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Users:</span>
                    <span className="text-white font-semibold">{stats.totalUsers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Today:</span>
                    <span className="text-white font-semibold">{stats.activeToday || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Owners:</span>
                    <span className="text-purple-400 font-semibold">{users.filter((u: User) => u.role === 'owner').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Admins:</span>
                    <span className="text-blue-400 font-semibold">{users.filter((u: User) => u.role === 'admin').length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Database className="h-5 w-5 text-gold" />
                    Content Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Studies:</span>
                    <span className="text-white font-semibold">{stats.totalStudies || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Published Studies:</span>
                    <span className="text-green-400 font-semibold">{stats.publishedStudies || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Videos:</span>
                    <span className="text-white font-semibold">{stats.totalVideos || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">New Posts:</span>
                    <span className="text-white font-semibold">{stats.newPosts || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-gold" />
                    Security Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Banned Users:</span>
                    <span className="text-red-400 font-semibold">{users.filter((u: User) => u.isBanned).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">System Status:</span>
                    <span className="text-green-400 font-semibold">Operational</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cache Status:</span>
                    <span className="text-green-400 font-semibold">Active</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Advanced User Management Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-gold" />
                  Advanced User Management
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Comprehensive user administration with role management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user: User) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-semibold">{user.firstName} {user.lastName}</p>
                          <p className="text-gray-400 text-sm">{user.email}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge className={roleColors[(user.role || 'user') as keyof typeof roleColors] || roleColors.user}>
                              {user.role.toUpperCase()}
                            </Badge>
                            <Badge className={tierColors[(user.subscriptionTier || 'free') as keyof typeof tierColors] || tierColors.free}>
                              {user.subscriptionTier.toUpperCase()}
                            </Badge>
                            {user.isBanned && (
                              <Badge className="bg-red-600 text-white">BANNED</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                          onClick={() => {
                            const newRole = user.role === 'owner' ? 'admin' : user.role === 'admin' ? 'user' : 'admin';
                            updateRoleMutation.mutate({ userId: user.id, role: newRole });
                          }}
                          disabled={updateRoleMutation.isPending}
                        >
                          {user.role === 'owner' ? 'Demote to Admin' : user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                        </Button>
                        {user.role !== 'owner' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
                              >
                                Make Owner
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-gray-900 border-gray-800">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Promote to Owner</AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-400">
                                  This will grant {user.firstName} {user.lastName} full owner privileges. This action should be used with extreme caution.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-gray-800 text-white border-gray-700">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => updateRoleMutation.mutate({ userId: user.id, role: 'owner' })}
                                  className="bg-purple-600 hover:bg-purple-700"
                                >
                                  Confirm Promotion
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Control Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gold" />
                  System Maintenance
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Advanced system controls and maintenance operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={() => clearCacheMutation.mutate()}
                    disabled={clearCacheMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Clear System Cache
                  </Button>
                  
                  <Button
                    onClick={() => window.location.reload()}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Refresh Dashboard
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Emergency Reset
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-gray-900 border-gray-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Emergency System Reset</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-400">
                          This will clear all cached data and force a complete application refresh. Use only in emergencies.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-gray-800 text-white border-gray-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            queryClient.clear();
                            localStorage.clear();
                            window.location.reload();
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Execute Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gold" />
                  Security Management
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Monitor and manage platform security
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="text-white font-semibold mb-2">User Role Distribution</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Owners:</span>
                        <Badge className="bg-purple-600 text-white">
                          {users.filter((u: User) => u.role === 'owner').length}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Admins:</span>
                        <Badge className="bg-blue-600 text-white">
                          {users.filter((u: User) => u.role === 'admin').length}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Regular Users:</span>
                        <Badge className="bg-gray-600 text-white">
                          {users.filter((u: User) => u.role === 'user').length}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="text-white font-semibold mb-2">Security Status</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">System Status:</span>
                        <Badge className="bg-green-600 text-white">Secure</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Authentication:</span>
                        <Badge className="bg-green-600 text-white">Active</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Banned Accounts:</span>
                        <Badge className="bg-red-600 text-white">
                          {users.filter((u: User) => u.isBanned).length}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}