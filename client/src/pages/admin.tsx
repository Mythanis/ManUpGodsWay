import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import UploadStudyForm from "@/components/admin/upload-study-form";
import UserManagement from "@/components/admin/user-management";
import DevotionalManagement from "@/components/admin/devotional-management";
import VideoManagement from "@/components/admin/video-management";
import LogoManagement from "@/components/admin/logo-management";
import HeaderLogoManagement from "@/components/admin/header-logo-management";
import SystemSettings from "@/components/admin/system-settings";
import PodcastManagement from "@/components/admin/podcast-management";
import ChallengeManagement from "@/components/admin/challenge-management";
import FitnessManagement from "@/components/admin/fitness-management";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Video, Bell, Activity, Calendar, Users, Book, Edit, Trash2, Crown, Gem, Eye, EyeOff, Star, Image, Settings, Headphones, Trophy, Dumbbell } from "lucide-react";

interface Study {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredTier: string;
  videoUrl?: string;
  duration: number;
  lessons: any[];
  tags: string[];
  author: string;
  isActive: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

const adminTabs = [
  { id: "content", label: "Content", icon: Book },
  { id: "studies", label: "Studies", icon: Activity },
  { id: "videos", label: "Videos", icon: Video },
  { id: "podcasts", label: "Podcasts", icon: Headphones },
  { id: "challenges", label: "Challenges", icon: Trophy },
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "devotionals", label: "Devotionals", icon: Calendar },
  { id: "logo", label: "Logo", icon: Image },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "users", label: "Users", icon: Users },
];

export default function Admin() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { effectiveTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStudy, setEditingStudy] = useState<Study | null>(null);
  const [activeTab, setActiveTab] = useState("content");
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationData, setNotificationData] = useState({
    title: "",
    message: "",
    type: "general" as "general" | "devotional" | "announcement",
    targetAudience: "everyone" as "everyone" | "vip" | "premium" | "individual",
    selectedUserIds: [] as string[]
  });
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    requiredTier: "free",
    videoUrl: "",
    duration: 0,
    author: "",
    tags: "",
    lessons: "",
  });
  const [videoInputType, setVideoInputType] = useState<'manual' | 'uploaded'>('manual');

  // Mouse wheel horizontal scrolling for admin tabs
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent default vertical scroll
      e.preventDefault();
      // Scroll horizontally instead
      container.scrollLeft += e.deltaY;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

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

  // Fetch all studies for management
  const { data: studies = [], isLoading: studiesLoading } = useQuery<Study[]>({
    queryKey: ["/api/studies"],
    retry: false,
    enabled: (user as any)?.role === 'admin',
  });

  // Fetch users for individual targeting
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
    enabled: (user as any)?.role === 'admin' && notificationData.targetAudience === 'individual',
  });

  // Fetch uploaded videos for study assignment
  const { data: uploadedVideos = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/videos"],
    retry: false,
    enabled: (user as any)?.role === 'admin' && showEditDialog,
  });

  // Update study mutation
  const updateStudyMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Study> }) => {
      return await apiRequest("PUT", `/api/studies/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowEditDialog(false);
      setEditingStudy(null);
      toast({
        title: "Success",
        description: "Study updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update study",
        variant: "destructive",
      });
    },
  });

  // Delete study mutation
  const deleteStudyMutation = useMutation({
    mutationFn: async (studyId: string) => {
      return await apiRequest("DELETE", `/api/studies/${studyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Study deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete study",
        variant: "destructive",
      });
    },
  });

  // Toggle publish status mutation
  const togglePublishMutation = useMutation({
    mutationFn: async ({ studyId, isPublished }: { studyId: string; isPublished: boolean }) => {
      return await apiRequest("PUT", `/api/studies/${studyId}`, { isPublished });
    },
    onSuccess: (_, { isPublished }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: `Study ${isPublished ? 'published' : 'unpublished'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update study status",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (study: Study) => {
    setEditingStudy(study);
    const videoUrl = study.videoUrl || "";
    // Determine if the video URL is an uploaded video ID or external URL
    const isUploadedVideo = !videoUrl.startsWith('http') && videoUrl.length > 10;
    setVideoInputType(isUploadedVideo ? 'uploaded' : 'manual');
    
    setFormData({
      title: study.title,
      description: study.description,
      category: study.category,
      requiredTier: study.requiredTier,
      videoUrl: study.videoUrl || "",
      duration: study.duration,
      author: study.author,
      tags: study.tags?.join(", ") || "",
      lessons: JSON.stringify(study.lessons, null, 2),
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!editingStudy) return;

    try {
      const updates = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        requiredTier: formData.requiredTier,
        videoUrl: formData.videoUrl || undefined,
        duration: formData.duration,
        author: formData.author,
        tags: formData.tags.split(",").map(tag => tag.trim()).filter(Boolean),
        lessons: formData.lessons ? JSON.parse(formData.lessons) : [],
      };

      console.log("Updating study with data:", updates);
      updateStudyMutation.mutate({ id: editingStudy.id, updates });
    } catch (error) {
      console.error("Error preparing update data:", error);
      toast({
        title: "Error",
        description: "Invalid lessons format. Please check your JSON syntax.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (studyId: string) => {
    if (confirm("Are you sure you want to delete this study? This action cannot be undone.")) {
      deleteStudyMutation.mutate(studyId);
    }
  };

  const handleTogglePublish = (studyId: string, isPublished: boolean) => {
    togglePublishMutation.mutate({ studyId, isPublished });
  };

  // Toggle featured status mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ studyId, isFeatured }: { studyId: string; isFeatured: boolean }) => {
      return await apiRequest("PUT", `/api/studies/${studyId}`, { isFeatured });
    },
    onSuccess: (_, { isFeatured }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: `Study ${isFeatured ? 'marked as featured' : 'removed from featured'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update featured status",
        variant: "destructive",
      });
    },
  });

  const handleToggleFeatured = (studyId: string, isFeatured: boolean) => {
    toggleFeaturedMutation.mutate({ studyId, isFeatured });
  };

  const sendNotification = useMutation({
    mutationFn: async (data: typeof notificationData) => {
      await apiRequest('POST', '/api/admin/notifications/broadcast', data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notification sent successfully!",
      });
      setShowNotificationDialog(false);
      setNotificationData({ title: "", message: "", type: "general", targetAudience: "everyone", selectedUserIds: [] });
      setUserSearchQuery("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send notification. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendNotification = () => {
    if (!notificationData.title.trim() || !notificationData.message.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in both title and message.",
        variant: "destructive",
      });
      return;
    }
    
    if (notificationData.targetAudience === 'individual' && notificationData.selectedUserIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one user for individual notifications.",
        variant: "destructive",
      });
      return;
    }
    
    sendNotification.mutate(notificationData);
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "premium":
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case "vip":
        return <Gem className="w-4 h-4 text-purple-600" />;
      default:
        return <Users className="w-4 h-4 text-green-600" />;
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "premium":
        return "bg-yellow-100 text-yellow-800";
      case "vip":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };

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
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-admin-title">Admin Panel</h1>
        <p className="text-blue-100 text-sm" data-testid="text-admin-subtitle">
          Content & User Management
        </p>
      </div>

      {/* Quick Stats */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-lg bg-ministry-gold-exact/20" data-testid="card-admin-stats">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-black" data-testid="text-total-users">
                  {(stats as any)?.totalUsers || 0}
                </p>
                <p className="text-xs text-black">Total Users</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-black" data-testid="text-total-studies">
                  {(stats as any)?.totalStudies || 0}
                </p>
                <p className="text-xs text-black">Studies</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-black" data-testid="text-active-today">
                  {(stats as any)?.activeToday || 0}
                </p>
                <p className="text-xs text-black">Active Today</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-black" data-testid="text-new-posts">
                  {(stats as any)?.newPosts || 0}
                </p>
                <p className="text-xs text-black">New Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Management Tabs */}
      <div className="px-6 mb-6">
        <div 
          ref={scrollContainerRef}
          className="flex space-x-3 overflow-x-auto scrollbar-hide horizontal-scroll pb-2"
        >
          {adminTabs.map((tab) => {
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

        <div className="mt-6">
          {activeTab === "content" && (
            <div className="space-y-4">
            <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Content Management</h2>
            <div className="space-y-4">
              <UploadStudyForm />
              
              <button 
                onClick={() => setActiveTab("videos")}
                className="p-4 rounded-2xl transition-colors flex items-center space-x-3 w-full cursor-pointer border-none"
                style={{
                  backgroundColor: 'hsl(215, 25%, 27%)',
                  color: 'white'
                }}
                data-testid="button-manage-videos"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(213, 12%, 47%)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(215, 25%, 27%)'}
              >
                <Video className="w-6 h-6" />
                <span className="font-medium">Manage Videos</span>
              </button>
              
              <button
                onClick={() => setShowNotificationDialog(true)}
                className="p-4 rounded-2xl border-none flex items-center space-x-3 w-full cursor-pointer transition-colors"
                style={{
                  backgroundColor: 'hsl(49, 100%, 49%)',
                  color: 'hsl(215, 25%, 27%)'
                }}
                data-testid="button-send-notification"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(49, 100%, 44%)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(49, 100%, 49%)'}
              >
                <Bell className="w-6 h-6" />
                <span className="font-medium">Send Push Notification</span>
              </button>
            </div>
            </div>
          )}

          {activeTab === "studies" && (
            <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ministry-charcoal">Study Management</h2>
              <UploadStudyForm />
            </div>
            
            {studiesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy"></div>
              </div>
            ) : studies.length === 0 ? (
              <Card className="bg-ministry-gold-exact/20">
                <CardContent className="p-8 text-center">
                  <Book className="w-12 h-12 text-black mx-auto mb-4" />
                  <p className="text-black">No studies created yet</p>
                  <p className="text-sm text-black">Click "Upload New Study" above to create your first study</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {studies.map((study) => (
                  <Card key={study.id} className="border-border bg-ministry-gold-exact/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg text-black mb-2">
                            {study.title}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {study.category}
                            </Badge>
                            <Badge className={`text-xs ${getTierBadgeColor(study.requiredTier)}`}>
                              <span className="flex items-center gap-1">
                                {getTierIcon(study.requiredTier)}
                                {study.requiredTier.toUpperCase()}
                              </span>
                            </Badge>
                            <span className="text-xs text-black">
                              {study.duration} min
                            </span>
                          </div>
                          <p className="text-sm text-black line-clamp-2">
                            {study.description}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            size="sm"
                            variant={study.isFeatured ? "default" : "outline"}
                            onClick={() => handleToggleFeatured(study.id, !study.isFeatured)}
                            disabled={toggleFeaturedMutation.isPending}
                            style={study.isFeatured ? {
                              backgroundColor: 'hsl(49, 100%, 49%)',
                              color: 'hsl(215, 25%, 27%)',
                              border: 'none'
                            } : {
                              backgroundColor: 'transparent',
                              color: 'hsl(215, 25%, 27%)',
                              border: '1px solid hsl(213, 12%, 47%)'
                            }}
                            title={study.isFeatured ? "Remove from featured" : "Mark as featured"}
                          >
                            <Star className={`w-4 h-4 ${study.isFeatured ? 'fill-current' : ''}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant={study.isPublished ? "default" : "outline"}
                            onClick={() => handleTogglePublish(study.id, !study.isPublished)}
                            disabled={togglePublishMutation.isPending}
                            style={study.isPublished ? {
                              backgroundColor: 'hsl(215, 25%, 27%)',
                              color: 'white',
                              border: 'none'
                            } : {
                              backgroundColor: 'transparent',
                              color: 'hsl(215, 25%, 27%)',
                              border: '1px solid hsl(213, 12%, 47%)'
                            }}
                          >
                            {study.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(study)}
                            style={{
                              backgroundColor: 'transparent',
                              color: 'hsl(215, 25%, 27%)',
                              border: '1px solid hsl(213, 12%, 47%)'
                            }}
                            data-testid={`button-edit-study-${study.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(study.id)}
                            disabled={deleteStudyMutation.isPending}
                            data-testid={`button-delete-study-${study.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ministry-slate">
                        <span>By Admin</span>
                        <span>•</span>
                        <span>{(study as any).lessonCount || 0} lessons</span>
                        <span>•</span>
                        <span>Created {new Date(study.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="capitalize">{study.category}</span>
                        <span>•</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          study.isPublished 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {study.isPublished ? 'Published' : 'Draft'}
                        </span>
                        {study.isFeatured && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Featured
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            </div>
          )}

          {activeTab === "videos" && (
            <div>
              <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Video Management</h2>
              <VideoManagement />
            </div>
          )}

          {activeTab === "devotionals" && (
            <div>
              <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Daily Devotional Management</h2>
              <DevotionalManagement />
            </div>
          )}

          {activeTab === "logo" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Splash Screen Logo</h2>
                <LogoManagement />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Header Logo</h2>
                <HeaderLogoManagement />
              </div>
            </div>
          )}
          
          {activeTab === "podcasts" && (
            <div>
              <PodcastManagement />
            </div>
          )}
          
          {activeTab === "challenges" && (
            <div>
              <ChallengeManagement />
            </div>
          )}

          {activeTab === "fitness" && (
            <div>
              <FitnessManagement />
            </div>
          )}

          {activeTab === "settings" && (
            <div>
              <SystemSettings />
            </div>
          )}

          {activeTab === "users" && (
            <div>
              <h2 className="text-lg font-bold text-ministry-charcoal mb-4">User Management</h2>
              <UserManagement />
            </div>
          )}
        </div>
      </div>

      {/* Edit Study Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Study</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Study title"
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <Label htmlFor="edit-author">Author</Label>
                <Input
                  id="edit-author"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  placeholder="Author name"
                  data-testid="input-edit-author"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Study description"
                rows={3}
                data-testid="input-edit-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="marriage">Marriage</SelectItem>
                    <SelectItem value="fatherhood">Fatherhood</SelectItem>
                    <SelectItem value="character">Character</SelectItem>
                    <SelectItem value="faith">Faith</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-tier">Required Tier</Label>
                <Select
                  value={formData.requiredTier}
                  onValueChange={(value) => setFormData({ ...formData, requiredTier: value })}
                >
                  <SelectTrigger data-testid="select-edit-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-duration">Duration (minutes)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  placeholder="Duration"
                  data-testid="input-edit-duration"
                />
              </div>
            </div>

            <div>
              <Label>Video Assignment (Optional)</Label>
              <div className="space-y-3">
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="videoInputType"
                      checked={videoInputType === 'manual'}
                      onChange={() => {
                        setVideoInputType('manual');
                        setFormData({ ...formData, videoUrl: '' });
                      }}
                      className="text-ministry-navy"
                    />
                    <span className="text-sm">Manual URL</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="videoInputType"
                      checked={videoInputType === 'uploaded'}
                      onChange={() => {
                        setVideoInputType('uploaded');
                        setFormData({ ...formData, videoUrl: '' });
                      }}
                      className="text-ministry-navy"
                    />
                    <span className="text-sm">Select Uploaded Video</span>
                  </label>
                </div>
                
                {videoInputType === 'manual' ? (
                  <Input
                    id="edit-video-url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                    data-testid="input-edit-video-url"
                  />
                ) : (
                  <Select
                    value={formData.videoUrl || "none"}
                    onValueChange={(value) => setFormData({ ...formData, videoUrl: value === "none" ? "" : value })}
                  >
                    <SelectTrigger data-testid="select-uploaded-video">
                      <SelectValue placeholder="Select an uploaded video" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No video</SelectItem>
                      {uploadedVideos.map((video: any) => (
                        <SelectItem key={video.id} value={video.id}>
                          <div className="flex items-center space-x-2">
                            <span>{video.title}</span>
                            <span className="text-xs text-gray-500">({video.requiredTier})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {videoInputType === 'manual' && (
                  <p className="text-xs text-ministry-slate">
                    Enter a YouTube, Vimeo, or direct video URL
                  </p>
                )}
                {videoInputType === 'uploaded' && (
                  <p className="text-xs text-ministry-slate">
                    Select from videos uploaded through the Video Management tab
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
                data-testid="input-edit-tags"
              />
            </div>

            <div>
              <Label htmlFor="edit-lessons">Lessons (JSON format)</Label>
              <Textarea
                id="edit-lessons"
                value={formData.lessons}
                onChange={(e) => setFormData({ ...formData, lessons: e.target.value })}
                placeholder="JSON array of lessons"
                rows={8}
                className="font-mono text-sm"
                data-testid="input-edit-lessons"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                className="border-ministry-steel text-ministry-charcoal hover:bg-ministry-steel/10"
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateStudyMutation.isPending || !formData.title.trim()}
                className="bg-ministry-navy hover:bg-ministry-charcoal"
                data-testid="button-save-edit"
              >
                {updateStudyMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent Activity */}
      <div className="px-6">
        <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Recent Admin Activity</h2>
        
        <Card className="border-border" data-testid="card-recent-activity">
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

      {/* Send Notification Dialog */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Bell className="w-5 h-5" />
              <span>Send Push Notification</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="notification-type" className="text-sm font-medium">
                Notification Type
              </Label>
              <Select
                value={notificationData.type}
                onValueChange={(value: "general" | "devotional" | "announcement") => 
                  setNotificationData({ ...notificationData, type: value })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="devotional">Devotional</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notification-title" className="text-sm font-medium">
                Title
              </Label>
              <Input
                id="notification-title"
                value={notificationData.title}
                onChange={(e) => setNotificationData({ ...notificationData, title: e.target.value })}
                placeholder="Enter notification title"
                className="mt-1"
                maxLength={50}
              />
              <p className="text-xs text-ministry-slate mt-1">
                {notificationData.title.length}/50 characters
              </p>
            </div>

            <div>
              <Label htmlFor="notification-message" className="text-sm font-medium">
                Message
              </Label>
              <Textarea
                id="notification-message"
                value={notificationData.message}
                onChange={(e) => setNotificationData({ ...notificationData, message: e.target.value })}
                placeholder="Enter notification message"
                className="mt-1"
                rows={4}
                maxLength={200}
              />
              <p className="text-xs text-ministry-slate mt-1">
                {notificationData.message.length}/200 characters
              </p>
            </div>

            <div>
              <Label htmlFor="target-audience" className="text-sm font-medium">
                Target Audience
              </Label>
              <Select
                value={notificationData.targetAudience}
                onValueChange={(value: "everyone" | "vip" | "premium" | "individual") => {
                  setNotificationData({ ...notificationData, targetAudience: value, selectedUserIds: [] });
                  setUserSearchQuery("");
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="vip">VIP Users Only</SelectItem>
                  <SelectItem value="premium">Premium Users Only</SelectItem>
                  <SelectItem value="individual">Individual Users</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {notificationData.targetAudience === 'individual' && (
              <div>
                <Label htmlFor="user-selection" className="text-sm font-medium">
                  Select Users
                </Label>
                <div className="mt-2">
                  <Input
                    placeholder="Search users by name or email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="mb-3"
                  />
                  <div className="max-h-40 overflow-y-auto border rounded-md p-3 space-y-2">
                    {allUsers
                      .filter(user => {
                        if (!userSearchQuery) return true;
                        const searchLower = userSearchQuery.toLowerCase();
                        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                        const email = user.email.toLowerCase();
                        return fullName.includes(searchLower) || email.includes(searchLower);
                      })
                      .map((user) => (
                        <div key={user.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`user-${user.id}`}
                            checked={notificationData.selectedUserIds.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNotificationData({
                                  ...notificationData,
                                  selectedUserIds: [...notificationData.selectedUserIds, user.id]
                                });
                              } else {
                                setNotificationData({
                                  ...notificationData,
                                  selectedUserIds: notificationData.selectedUserIds.filter(id => id !== user.id)
                                });
                              }
                            }}
                            className="rounded"
                          />
                          <label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer flex items-center space-x-2 flex-1">
                            <div className="flex flex-col">
                              <span>{user.firstName} {user.lastName}</span>
                              <span className="text-xs text-ministry-slate">{user.email}</span>
                            </div>
                            <Badge className={`text-xs ${getTierBadgeColor(user.subscriptionTier)}`}>
                              <span className="flex items-center gap-1">
                                {getTierIcon(user.subscriptionTier)}
                                {user.subscriptionTier.toUpperCase()}
                              </span>
                            </Badge>
                          </label>
                        </div>
                      ))}
                    {allUsers.filter(user => {
                      if (!userSearchQuery) return true;
                      const searchLower = userSearchQuery.toLowerCase();
                      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                      const email = user.email.toLowerCase();
                      return fullName.includes(searchLower) || email.includes(searchLower);
                    }).length === 0 && (
                      <p className="text-sm text-ministry-slate">
                        {userSearchQuery ? "No users found matching your search" : "No users available"}
                      </p>
                    )}
                  </div>
                  {notificationData.selectedUserIds.length > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-ministry-slate">
                        {notificationData.selectedUserIds.length} user(s) selected
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNotificationData({
                          ...notificationData,
                          selectedUserIds: []
                        })}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNotificationDialog(false);
                  setNotificationData({ title: "", message: "", type: "general", targetAudience: "everyone", selectedUserIds: [] });
                  setUserSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendNotification}
                disabled={sendNotification.isPending || !notificationData.title.trim() || !notificationData.message.trim()}
                className="bg-ministry-gold text-ministry-navy hover:bg-ministry-gold/90"
              >
                {sendNotification.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ministry-navy mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Send Notification
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
