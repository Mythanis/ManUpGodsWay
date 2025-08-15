import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UploadStudyForm from "@/components/admin/upload-study-form";
import UserManagement from "@/components/admin/user-management";
import DevotionalManagement from "@/components/admin/devotional-management";
import { Plus, Video, Bell, Activity, Calendar, Users, Book } from "lucide-react";

export default function Admin() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Check admin access
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (user as any)?.role !== 'admin')) {
      toast({
        title: "Access Denied",
        description: "Admin access required",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, user, toast]);

  const { data: stats } = useQuery<{
    totalUsers: number;
    totalStudies: number;
    activeToday: number;
    newPosts: number;
  }>({
    queryKey: ["/api/admin/stats"],
    retry: false,
    enabled: (user as any)?.role === 'admin',
  });

  if (authLoading || (user as any)?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-admin-title">Admin Panel</h1>
        <p className="text-red-100 text-sm" data-testid="text-admin-subtitle">
          Content & User Management
        </p>
      </div>

      {/* Quick Stats */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-lg" data-testid="card-admin-stats">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-ministry-navy" data-testid="text-total-users">
                  {(stats as any)?.totalUsers || 0}
                </p>
                <p className="text-xs text-ministry-slate">Total Users</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-ministry-steel" data-testid="text-total-studies">
                  {(stats as any)?.totalStudies || 0}
                </p>
                <p className="text-xs text-ministry-slate">Studies</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-ministry-success" data-testid="text-active-today">
                  {(stats as any)?.activeToday || 0}
                </p>
                <p className="text-xs text-ministry-slate">Active Today</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-ministry-gold" data-testid="text-new-posts">
                  {(stats as any)?.newPosts || 0}
                </p>
                <p className="text-xs text-ministry-slate">New Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Management Tabs */}
      <div className="px-6 mb-6">
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100">
            <TabsTrigger value="content" className="flex items-center space-x-2" data-testid="tab-content">
              <Book className="w-4 h-4" />
              <span>Content</span>
            </TabsTrigger>
            <TabsTrigger value="devotionals" className="flex items-center space-x-2" data-testid="tab-devotionals">
              <Calendar className="w-4 h-4" />
              <span>Devotionals</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2" data-testid="tab-users">
              <Users className="w-4 h-4" />
              <span>Users</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 mt-6">
            <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Content Management</h2>
            <div className="space-y-4">
              <UploadStudyForm />
              
              <Button 
                variant="outline"
                className="bg-ministry-steel text-white p-4 rounded-2xl hover:bg-ministry-navy border-none flex items-center space-x-3 w-full"
                data-testid="button-manage-videos"
              >
                <Video className="w-6 h-6" />
                <span className="font-medium">Manage Videos</span>
              </Button>
              
              <Button 
                variant="outline"
                className="bg-ministry-gold text-ministry-navy p-4 rounded-2xl hover:bg-ministry-gold/90 border-none flex items-center space-x-3 w-full"
                data-testid="button-send-notification"
              >
                <Bell className="w-6 h-6" />
                <span className="font-medium">Send Push Notification</span>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="devotionals" className="mt-6">
            <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Daily Devotional Management</h2>
            <DevotionalManagement />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <h2 className="text-lg font-bold text-ministry-charcoal mb-4">User Management</h2>
            <UserManagement />
          </TabsContent>
        </Tabs>
      </div>

      {/* Recent Activity */}
      <div className="px-6">
        <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Recent Admin Activity</h2>
        
        <Card className="border-gray-100" data-testid="card-recent-activity">
          <CardContent className="p-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2">
                <span className="text-ministry-charcoal">System statistics updated</span>
                <span className="text-ministry-slate text-xs">Just now</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-ministry-charcoal">Admin panel accessed</span>
                <span className="text-ministry-slate text-xs">1 minute ago</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-ministry-charcoal">User management viewed</span>
                <span className="text-ministry-slate text-xs">5 minutes ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
