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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UploadStudyForm from "@/components/admin/upload-study-form";
import StudyManagement from "@/components/admin/study-management";
import UserManagement from "@/components/admin/user-management";
import DevotionalManagement from "@/components/admin/devotional-management";
import VideoManagement from "@/components/admin/video-management";
import LogoManagement from "@/components/admin/logo-management";
import HeaderLogoManagement from "@/components/admin/header-logo-management";
import SystemSettings from "@/components/admin/system-settings";
import PodcastManagement from "@/components/admin/podcast-management";
import ChallengeManagement from "@/components/admin/challenge-management";
import FitnessManagement from "@/components/admin/fitness-management";
import EventManagement from "@/components/admin/event-management";
import TierPricingManagement from "@/components/admin/tier-pricing-management";
import CarouselManagement from "@/components/admin/carousel-management";
import BlogManagement from "@/components/admin/blog-management";
import WarGroupsManagement from "@/components/admin/war-groups-management";
import WarGroupRegistrationsManagement from "@/components/admin/war-group-registrations-management";
import LiveStreamManagement from "@/components/admin/live-stream-management";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Video, Bell, Activity, Calendar, Users, Book, Edit, Trash2, Crown, Gem, Eye, EyeOff, Star, Image, Settings, Headphones, Trophy, Dumbbell, DollarSign, ImagePlus, ChevronLeft, ChevronRight, Shield, Radio, FileText } from "lucide-react";

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
  requiresPurchase?: boolean;
  price?: string;
  purchaseRequiredTiers?: string[];
  createdAt: string;
  updatedAt: string;
}

const adminTabs = [
  { id: "content", label: "Content", icon: Book },
  { id: "studies", label: "Studies", icon: Activity },
  { id: "videos", label: "Videos", icon: Video },
  { id: "podcasts", label: "Podcasts", icon: Headphones },
  { id: "live-streams", label: "Live", icon: Radio },
  { id: "blogs", label: "Blogs", icon: FileText },
  { id: "challenges", label: "Challenges", icon: Trophy },
  { id: "carousel", label: "Carousel", icon: ImagePlus },
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "events", label: "Events", icon: Calendar },
  { id: "devotionals", label: "Devotionals", icon: Calendar },
  { id: "war-groups", label: "War Groups", icon: Shield },
  { id: "logo", label: "Logo", icon: Image },
  { id: "tiers", label: "Tiers", icon: DollarSign },
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
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showContentDialog, setShowContentDialog] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationData, setNotificationData] = useState({
    title: "",
    message: "",
    type: "general" as "general" | "devotional" | "announcement",
    targetAudience: "everyone" as "everyone" | "vip" | "premium" | "individual",
    selectedUserIds: [] as string[]
  });
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingWord, setUploadingWord] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    requiredTier: "free",
    videoUrl: "",
    duration: 0,
    author: "",
    tags: "",
    requiresPurchase: false,
    price: "",
    purchaseRequiredTiers: [] as string[],
  });
  const [videoInputType, setVideoInputType] = useState<'manual' | 'uploaded'>('manual');

  // Check scroll position to show/hide arrows
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  };

  // Scroll left/right
  const scrollLeft = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: -200, behavior: 'smooth' });
  };

  const scrollRight = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: 200, behavior: 'smooth' });
  };

  // Mouse wheel horizontal scrolling for admin tabs
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent default vertical scroll
      e.preventDefault();
      // Scroll horizontally instead
      container.scrollLeft += e.deltaY;
      checkScrollPosition();
    };

    const handleScroll = () => {
      checkScrollPosition();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('scroll', handleScroll);
    
    // Initial check
    checkScrollPosition();
    
    // Check on resize
    const resizeObserver = new ResizeObserver(checkScrollPosition);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  // Check admin access
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !['admin', 'owner'].includes((user as any)?.role))) {
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
    enabled: ['admin', 'owner'].includes((user as any)?.role),
  });

  // Fetch all studies for management
  const { data: studies = [], isLoading: studiesLoading } = useQuery<Study[]>({
    queryKey: ["/api/studies"],
    retry: false,
    enabled: ['admin', 'owner'].includes((user as any)?.role),
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

  // Fetch pending war group registrations count
  const { data: pendingRegistrations = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/war-groups/registrations', 'pending'],
    queryFn: async () => {
      const response = await fetch('/api/admin/war-groups/registrations?status=pending');
      if (!response.ok) throw new Error('Failed to fetch registrations');
      return response.json();
    },
    retry: false,
    enabled: ['admin', 'owner'].includes((user as any)?.role),
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
      requiresPurchase: study.requiresPurchase || false,
      price: study.price || "",
      purchaseRequiredTiers: study.purchaseRequiredTiers || [],
    });
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingStudy) return;

    // First, upload any selected files
    if (pdfFile) {
      await handleFileUpload(pdfFile, 'pdf');
    }
    if (wordFile) {
      await handleFileUpload(wordFile, 'word');
    }

    const updates = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      requiredTier: formData.requiredTier,
      videoUrl: formData.videoUrl || undefined,
      duration: formData.duration,
      author: formData.author,
      tags: formData.tags.split(",").map(tag => tag.trim()).filter(Boolean),
      requiresPurchase: formData.requiresPurchase,
      price: formData.requiresPurchase ? formData.price : undefined,
      purchaseRequiredTiers: formData.requiresPurchase ? formData.purchaseRequiredTiers : [],
    };

    console.log("Updating study with data:", updates);
    updateStudyMutation.mutate({ id: editingStudy.id, updates });
  };

  const handleFileUpload = async (file: File, type: 'pdf' | 'word') => {
    if (!editingStudy) return;

    const formData = new FormData();
    formData.append(type, file);

    const setUploading = type === 'pdf' ? setUploadingPdf : setUploadingWord;
    
    try {
      setUploading(true);
      const response = await fetch(`/api/studies/${editingStudy.id}/upload-${type}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to upload ${type} file`);
      }

      toast({
        title: "Success",
        description: `${type.toUpperCase()} document uploaded successfully`,
      });

      // Refresh the study list
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      
      // Update editing study with new file info
      const updatedStudy = await response.json();
      setEditingStudy(updatedStudy);
      
      // Clear file input
      if (type === 'pdf') setPdfFile(null);
      if (type === 'word') setWordFile(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to upload ${type} file`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (type: 'pdf' | 'word') => {
    if (!editingStudy) return;

    if (!confirm(`Are you sure you want to delete this ${type.toUpperCase()} document?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/studies/${editingStudy.id}/delete-${type}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete ${type} file`);
      }

      toast({
        title: "Success",
        description: `${type.toUpperCase()} document deleted successfully`,
      });

      // Refresh the study list
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      
      // Update editing study
      const updatedStudy = await response.json();
      setEditingStudy(updatedStudy);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to delete ${type} file`,
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

  if (authLoading || !['admin', 'owner'].includes((user as any)?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-ministry-light-gray min-h-screen">
      {/* Admin Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
        <h1 className="text-4xl font-black tracking-tighter uppercase" data-testid="text-admin-title">
          Owner <span className="text-ministry-gold-exact">Dashboard</span>
        </h1>
        <p className="text-ministry-gold-exact text-sm font-bold uppercase tracking-wide" data-testid="text-admin-subtitle">
          Content & User Management
        </p>
      </div>

      {/* Quick Stats */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4" data-testid="card-admin-stats">
          <div className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-black" data-testid="text-total-users">
              {(stats as any)?.totalUsers || 0}
            </p>
            <p className="text-xs font-bold uppercase tracking-wide text-black">Total Users</p>
          </div>
          <div className="bg-black border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(212,175,55,1)] p-4 text-center">
            <p className="text-3xl font-black text-ministry-gold-exact" data-testid="text-total-studies">
              {(stats as any)?.totalStudies || 0}
            </p>
            <p className="text-xs font-bold uppercase tracking-wide text-white">Studies</p>
          </div>
          <div className="bg-black border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(212,175,55,1)] p-4 text-center">
            <p className="text-3xl font-black text-ministry-gold-exact" data-testid="text-active-today">
              {(stats as any)?.activeToday || 0}
            </p>
            <p className="text-xs font-bold uppercase tracking-wide text-white">Active Today</p>
          </div>
          <div className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
            <p className="text-3xl font-black text-black" data-testid="text-new-posts">
              {(stats as any)?.newPosts || 0}
            </p>
            <p className="text-xs font-bold uppercase tracking-wide text-black">New Posts</p>
          </div>
        </div>
      </div>

      {/* Admin Management Buttons */}
      <div className="px-6 mb-6">
        <div className="space-y-2">
          {adminTabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowContentDialog(true);
                }}
                className="h-16 w-full flex items-center justify-between liquid-gold-card border-2 border-black p-0 overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer"
                data-testid={`tab-${tab.id}`}
              >
                <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                  <IconComponent className="w-6 h-6 text-white relative z-10" />
                </div>
                <span className="flex-1 font-black text-sm text-left px-4 uppercase tracking-wide text-black relative z-10">{tab.label}</span>
                <div className="pr-4">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Dialog */}
      <Dialog open={showContentDialog} onOpenChange={setShowContentDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-wide">
              {adminTabs.find(t => t.id === activeTab)?.label || 'Management'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
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
              <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Study Management</h2>
              <StudyManagement />
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

          {activeTab === "live-streams" && (
            <div>
              <LiveStreamManagement />
            </div>
          )}
          
          {activeTab === "challenges" && (
            <div>
              <ChallengeManagement />
            </div>
          )}

          {activeTab === "blogs" && (
            <div>
              <BlogManagement />
            </div>
          )}

          {activeTab === "carousel" && (
            <div>
              <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Homepage Carousel Management</h2>
              <CarouselManagement />
            </div>
          )}

          {activeTab === "fitness" && (
            <div>
              <FitnessManagement />
            </div>
          )}

          {activeTab === "events" && (
            <div>
              <EventManagement />
            </div>
          )}

          {activeTab === "settings" && (
            <div>
              <SystemSettings />
            </div>
          )}

          {activeTab === "tiers" && (
            <div>
              <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Tier Pricing Configuration</h2>
              <TierPricingManagement />
            </div>
          )}

          {activeTab === "war-groups" && (
            <div className="space-y-6">
              <Tabs defaultValue="groups" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="groups">Manage Groups</TabsTrigger>
                  <TabsTrigger value="registrations" className="relative">
                    Registrations
                    {pendingRegistrations.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {pendingRegistrations.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="groups">
                  <WarGroupsManagement />
                </TabsContent>
                <TabsContent value="registrations">
                  <WarGroupRegistrationsManagement />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {activeTab === "users" && (
            <div>
              <h2 className="text-lg font-bold text-ministry-charcoal mb-4">User Management</h2>
              <UserManagement />
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

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

            {/* Purchase Options Section */}
            <div className="flex items-center justify-between rounded-lg border border-ministry-steel p-4 bg-ministry-steel/5">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold text-ministry-charcoal">Requires Purchase</Label>
                <div className="text-sm text-ministry-slate">
                  Make this study available for purchase
                </div>
              </div>
              <Switch
                checked={formData.requiresPurchase || false}
                onCheckedChange={(checked) => setFormData({ ...formData, requiresPurchase: checked, price: checked ? formData.price : "" })}
                data-testid="switch-edit-requires-purchase"
              />
            </div>

            {/* Price field - only show when requiresPurchase is true */}
            {formData.requiresPurchase && (
              <div>
                <Label htmlFor="edit-price" className="text-base font-semibold text-ministry-charcoal">Price ($)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0.50"
                  value={formData.price || ""}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.50 (minimum)"
                  className="border-ministry-steel focus:border-ministry-gold"
                  data-testid="input-edit-price"
                />
              </div>
            )}

            {/* Tier checkboxes - only show when requiresPurchase is true */}
            {formData.requiresPurchase && (
              <div>
                <Label className="text-base font-semibold text-ministry-charcoal">Purchase Required For</Label>
                <div className="space-y-2">
                  {/* All selection checkbox */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-all-tiers"
                      checked={(formData.purchaseRequiredTiers || []).length === 3}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, purchaseRequiredTiers: ['free', 'premium', 'vip'] });
                        } else {
                          setFormData({ ...formData, purchaseRequiredTiers: [] });
                        }
                      }}
                      className="rounded border-ministry-steel text-ministry-gold focus:ring-ministry-gold"
                      data-testid="checkbox-edit-all-tiers"
                    />
                    <label htmlFor="edit-all-tiers" className="text-sm text-ministry-charcoal">
                      All Tiers
                    </label>
                  </div>
                  
                  {/* Individual tier checkboxes */}
                  {[{ id: 'free', label: 'Free' }, { id: 'premium', label: 'Premium' }, { id: 'vip', label: 'VIP' }].map((tier) => (
                    <div key={tier.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`edit-tier-${tier.id}`}
                        checked={(formData.purchaseRequiredTiers || []).includes(tier.id)}
                        onChange={(e) => {
                          const currentTiers = [...(formData.purchaseRequiredTiers || [])];
                          if (e.target.checked) {
                            if (!currentTiers.includes(tier.id)) {
                              currentTiers.push(tier.id);
                            }
                          } else {
                            const index = currentTiers.indexOf(tier.id);
                            if (index > -1) {
                              currentTiers.splice(index, 1);
                            }
                          }
                          setFormData({ ...formData, purchaseRequiredTiers: currentTiers });
                        }}
                        className="rounded border-ministry-steel text-ministry-gold focus:ring-ministry-gold"
                        data-testid={`checkbox-edit-tier-${tier.id}`}
                      />
                      <label htmlFor={`edit-tier-${tier.id}`} className="text-sm text-ministry-charcoal">
                        {tier.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* PDF File Management */}
            <div className="space-y-2">
              <Label>PDF Document</Label>
              {editingStudy && (editingStudy as any).pdfFilename ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-900 flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{(editingStudy as any).pdfOriginalName || 'PDF Document'}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleFileDelete('pdf')}
                    data-testid="button-delete-pdf"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="edit-pdf-file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    data-testid="input-edit-pdf"
                  />
                  {pdfFile && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Selected: {pdfFile.name} - will upload when you save changes
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Word File Management */}
            <div className="space-y-2">
              <Label>Word Document (.docx only)</Label>
              {editingStudy && (editingStudy as any).wordFilename ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{(editingStudy as any).wordOriginalName || 'Word Document'}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleFileDelete('word')}
                      data-testid="button-delete-word"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {(editingStudy as any).wordOriginalName?.toLowerCase().endsWith('.docx') && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setShowEditDialog(false);
                        setTimeout(() => {
                          window.location.href = `/admin/studies/${editingStudy.id}/edit-word`;
                        }, 100);
                      }}
                      className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal font-bold shadow-md"
                      data-testid="button-edit-sections"
                    >
                      📝 Mark Editable Sections
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="edit-word-file"
                    type="file"
                    accept=".docx"
                    onChange={(e) => setWordFile(e.target.files?.[0] || null)}
                    data-testid="input-edit-word"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Only .docx files are supported for interactive viewing.
                  </p>
                  {wordFile && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Selected: {wordFile.name} - will upload when you save changes
                    </p>
                  )}
                </div>
              )}
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
                className="bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal font-semibold"
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
        
        <Card className="border-ministry-charcoal" data-testid="card-recent-activity">
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
