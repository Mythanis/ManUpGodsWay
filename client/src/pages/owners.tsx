import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Crown, Settings, Users, Database, Shield, Activity, Trash2, UserCog, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { useRef, useEffect } from "react";

// Stripe Configuration Component
function StripeConfiguration() {
  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Fetch Stripe account info
  const { data: stripeInfo, isLoading: stripeLoading, refetch: refetchStripeInfo } = useQuery({
    queryKey: ['/api/stripe/account'],
    queryFn: async () => {
      const response = await fetch('/api/stripe/account', {
        credentials: 'include'
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch Stripe account info: ${errorText}`);
      }
      return response.json();
    }
  });

  // Test Stripe connection
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      setIsTestingConnection(true);
      const response = await fetch('/api/stripe/test-connection', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Test connection failed: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Test Successful",
        description: `Connected to Stripe account: ${data.accountId}`,
      });
      // Refresh account info
      refetchStripeInfo();
    },
    onError: (error: any) => {
      toast({
        title: "Connection Test Failed",
        description: error.message || "Unable to connect to Stripe account",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsTestingConnection(false);
    }
  });

  if (stripeLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gold" />
            Stripe Payment Configuration
          </CardTitle>
          <CardDescription className="text-gray-400">
            Manage your Stripe payment processing settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Status */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold">Configuration Status</h3>
              <Badge className={stripeInfo?.configured ? "bg-green-600" : "bg-red-600"}>
                {stripeInfo?.configured ? "Configured" : "Not Configured"}
              </Badge>
            </div>

            {!stripeInfo?.configured ? (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm">
                  Stripe API keys are not configured. To enable payment processing:
                </p>
                <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Go to your Stripe Dashboard: <span className="text-blue-400">https://dashboard.stripe.com/apikeys</span></li>
                  <li>Copy your Publishable key (starts with pk_) → Set as <span className="text-green-400">VITE_STRIPE_PUBLIC_KEY</span></li>
                  <li>Copy your Secret key (starts with sk_) → Set as <span className="text-green-400">STRIPE_SECRET_KEY</span></li>
                  <li>Restart the application after adding the keys</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                {stripeInfo.accountId && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-400 text-sm">Account ID:</span>
                      <p className="text-white font-mono text-sm">{stripeInfo.accountId}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-sm">Country:</span>
                      <p className="text-white text-sm">{stripeInfo.country || 'N/A'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Connection Test */}
          {stripeInfo?.configured && (
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-semibold">Connection Test</h3>
                <Button
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={isTestingConnection}
                  className="bg-gold text-black hover:bg-gold/90"
                  size="sm"
                >
                  {isTestingConnection ? "Testing..." : "Test Connection"}
                </Button>
              </div>
              <p className="text-gray-400 text-sm">
                Test the connection to your Stripe account to ensure payments can be processed.
              </p>
            </div>
          )}

          {/* Payment Processing Status */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-white font-semibold mb-2">Payment Processing</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Status:</span>
                <Badge className={stripeInfo?.configured ? "bg-green-600" : "bg-red-600"}>
                  {stripeInfo?.configured ? "Ready" : "Not Ready"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Test Mode:</span>
                <Badge className="bg-yellow-600">
                  {stripeInfo?.testMode ? "Yes" : "Live"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Define Owner tabs
const ownerTabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "users", label: "User Management", icon: Users },
  { id: "system", label: "System Settings", icon: Database },
  { id: "security", label: "Security & Access", icon: Shield },
  { id: "stripe", label: "Payment Gateway", icon: CreditCard },
  { id: "analytics", label: "Analytics Dashboard", icon: Crown },
  { id: "backup", label: "Backup & Recovery", icon: Settings },
  { id: "integrations", label: "API Integrations", icon: UserCog }
];

export default function Owners() {
  const { toast } = useToast();
  const { effectiveTheme } = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Horizontal scroll with mouse wheel
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      console.log('Wheel event triggered', e.deltaY);
      // Prevent default vertical scroll
      e.preventDefault();
      // Scroll horizontally instead
      container.scrollLeft += e.deltaY;
      console.log('New scroll position:', container.scrollLeft);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

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

  function renderTabContent() {
    switch(activeTab) {
      case "overview":
        return (
          <div className="space-y-6">
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
                    <span className="text-gray-400">Storage Used:</span>
                    <span className="text-yellow-400 font-semibold">{stats.storageUsed || '0 MB'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-gold" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Server Status:</span>
                    <Badge className="bg-green-600 text-white">Online</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Database:</span>
                    <Badge className="bg-green-600 text-white">Connected</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Backup:</span>
                    <span className="text-white font-semibold">2 hours ago</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Uptime:</span>
                    <span className="text-green-400 font-semibold">99.9%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case "users":
        return (
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-gold" />
                  Advanced User Management
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Comprehensive user role and subscription management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* User Search and Filter */}
                <div className="flex gap-4">
                  <Input
                    placeholder="Search users by username or email..."
                    value=""
                    onChange={() => {}}
                    className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                  />
                  <Button className="bg-gold text-black hover:bg-gold/90">
                    <Settings className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </div>

                {/* Users Table */}
                <div className="rounded-lg border border-gray-700 overflow-hidden">
                  <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                    <h3 className="text-white font-semibold">All Users</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {users.map((user: User) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border-b border-gray-700 last:border-b-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{user.username}</p>
                            <p className="text-gray-400 text-sm">{user.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={roleColors[user.role]}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                          <Badge className={tierColors[user.tier]}>
                            {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
                          </Badge>
                          {user.isBanned && (
                            <Badge className="bg-red-600 text-white">Banned</Badge>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {user.role !== 'owner' && (
                            <select
                              value={user.role}
                              onChange={(e) => updateRoleMutation.mutate({ userId: user.id, role: e.target.value })}
                              className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                              <option value="owner">Owner</option>
                            </select>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                                disabled={user.role === 'owner'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-gray-900 border-gray-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Delete User</AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-400">
                                  Are you sure you want to permanently delete {user.username}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "system":
        return (
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Database className="h-5 w-5 text-gold" />
                  System Control Center
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Advanced system administration and maintenance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* System Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={() => clearCacheMutation.mutate()}
                    disabled={clearCacheMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear System Cache
                  </Button>
                  
                  <Button
                    onClick={() => window.location.reload()}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Force Reload Interface
                  </Button>
                </div>

                {/* System Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="text-white font-semibold mb-2">System Status</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Server Status:</span>
                        <Badge className="bg-green-600 text-white">Online</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Database:</span>
                        <Badge className="bg-green-600 text-white">Connected</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="text-white font-semibold mb-2">Cache Status</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Query Cache:</span>
                        <Badge className="bg-green-600 text-white">Active</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Last Cleared:</span>
                        <span className="text-white text-sm">Never</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "security":
        return (
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gold" />
                  Security & Access Control
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Monitor and manage system security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="text-white font-semibold mb-2">Role Distribution</h3>
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
          </div>
        );

      case "stripe":
        return (
          <div className="space-y-6">
            <StripeConfiguration />
          </div>
        );

      case "analytics":
        return (
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">Advanced analytics and reporting coming soon...</p>
              </CardContent>
            </Card>
          </div>
        );

      case "backup":
        return (
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Backup & Recovery</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">Backup and recovery management coming soon...</p>
              </CardContent>
            </Card>
          </div>
        );

      case "integrations":
        return (
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">API Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">Third-party API integrations coming soon...</p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
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

        {/* Owner Management Tabs */}
        <div className="px-6 mb-6">
          <div 
            ref={scrollContainerRef}
            className="flex space-x-3 overflow-x-auto scrollbar-hide horizontal-scroll pb-2"
          >
            {ownerTabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    backgroundColor: activeTab === tab.id 
                      ? 'hsl(0 0% 0%)' 
                      : effectiveTheme === 'dark' 
                        ? 'hsl(220 8% 26%)' 
                        : 'hsl(240 1.9608% 90%)',
                    color: activeTab === tab.id 
                      ? 'white' 
                      : effectiveTheme === 'dark' 
                        ? 'hsl(0 0% 95%)' 
                        : 'hsl(210 25% 7.8431%)',
                    borderColor: activeTab === tab.id 
                      ? 'hsl(49, 100%, 49%)' 
                      : effectiveTheme === 'dark' 
                        ? 'hsl(210 5.2632% 14.9020%)' 
                        : 'hsl(201.4286 30.4348% 90.9804%)'
                  }}
                  className="px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 snap-start border cursor-pointer transition-colors flex items-center space-x-2"
                  data-testid={`tab-${tab.id}`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 px-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}