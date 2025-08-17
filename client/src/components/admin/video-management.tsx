import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/queryClient";
import { formatLocalDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Search, Upload, Play, Trash2, Eye, Edit, Video as VideoIcon, FileText, Clock, HardDrive, Crown, Gem, Zap, Star } from "lucide-react";

interface Video {
  id: string;
  title: string;
  description?: string;
  category?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  duration?: number;
  thumbnailUrl?: string;
  uploadedBy: string;
  requiredTier: string;
  isFeatured: boolean;
  isProcessed: boolean;
  processingStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function VideoManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [isWatchingVideo, setIsWatchingVideo] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadTier, setUploadTier] = useState('free');
  const [uploadCategory, setUploadCategory] = useState('general');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [titleExists, setTitleExists] = useState(false);
  const [checkingTitle, setCheckingTitle] = useState(false);
  const { toast } = useToast();
  const { effectiveTheme } = useTheme();
  const queryClient = useQueryClient();

  const { data: videos = [], isLoading } = useQuery<Video[]>({
    queryKey: ["/api/admin/videos"],
    retry: false,
  });

  // Debounced title validation
  const checkTitleExists = useCallback(async (title: string, excludeVideoId?: string) => {
    if (!title || title.trim().length < 3) {
      setTitleExists(false);
      return;
    }

    setCheckingTitle(true);
    try {
      const url = excludeVideoId 
        ? `/api/check-title/${encodeURIComponent(title.trim())}?excludeVideoId=${excludeVideoId}`
        : `/api/check-title/${encodeURIComponent(title.trim())}`;
        
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTitleExists(data.exists);
      }
    } catch (error) {
      console.error('Error checking title:', error);
    } finally {
      setCheckingTitle(false);
    }
  }, []);

  // Watch upload title for changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkTitleExists(uploadTitle, selectedVideo?.id);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [uploadTitle, selectedVideo?.id, checkTitleExists]);

  // Watch selected video title for changes (when editing)
  useEffect(() => {
    if (selectedVideo) {
      const timeoutId = setTimeout(() => {
        checkTitleExists(selectedVideo.title, selectedVideo.id);
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    } else {
      // Reset validation when no video is selected
      setTitleExists(false);
      setCheckingTitle(false);
    }
  }, [selectedVideo?.title, selectedVideo?.id, checkTitleExists]);

  const uploadVideo = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/admin/videos/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/videos"] });
      setShowUploadDialog(false);
      setUploadProgress(0);
      setUploading(false);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadDescription('');
      setUploadTier('free');
      setUploadCategory('general');
      setTitleExists(false);
      setCheckingTitle(false);
      toast({
        title: "Success",
        description: "Video uploaded successfully!",
      });
    },
    onError: (error: any) => {
      setUploading(false);
      setUploadProgress(0);
      
      // Extract error message from API response
      let errorMessage = "Failed to upload video. Please try again.";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateVideo = useMutation({
    mutationFn: async ({ id, video }: { id: string; video: Partial<Video> }) => {
      await apiRequest('PUT', `/api/admin/videos/${id}`, video);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/videos"] });
      setShowVideoDialog(false);
      setIsWatchingVideo(false);
      toast({
        title: "Success",
        description: "Video updated successfully!",
      });
    },
    onError: (error: any) => {
      // Extract error message from API response
      let errorMessage = "Failed to update video. Please try again.";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteVideo = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/admin/videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/videos"] });
      setShowVideoDialog(false);
      setIsWatchingVideo(false);
      toast({
        title: "Success",
        description: "Video deleted successfully!",
      });
    },
    onError: (error: any) => {
      // Extract error message from API response
      let errorMessage = "Failed to delete video. Please try again.";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const filteredVideos = videos.filter((video: Video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'vip':
        return (
          <Badge className="bg-purple-100 text-purple-800 flex items-center space-x-1">
            <Crown className="w-3 h-3" />
            <span>VIP</span>
          </Badge>
        );
      case 'premium':
        return (
          <Badge className="bg-blue-100 text-blue-800 flex items-center space-x-1">
            <Gem className="w-3 h-3" />
            <span>Premium</span>
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-foreground flex items-center space-x-1">
            <Zap className="w-3 h-3" />
            <span>Free</span>
          </Badge>
        );
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid File",
        description: "Please select a valid video file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Video file must be smaller than 100MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setUploadTitle(file.name.replace(/\.[^/.]+$/, "")); // Remove extension
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadTitle.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a file and provide a title.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', uploadTitle);
    formData.append('description', uploadDescription);
    formData.append('requiredTier', uploadTier);
    formData.append('category', uploadCategory);

    setUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 10;
      });
    }, 200);

    uploadVideo.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy mx-auto mb-4"></div>
        <p className="text-ministry-slate">Loading videos...</p>
      </div>
    );
  }

  return (
    <Card className="border-gray-100 overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <VideoIcon className="w-5 h-5" />
            <span>Video Management</span>
          </CardTitle>
          <button 
            onClick={() => setShowUploadDialog(true)} 
            style={{
              backgroundColor: effectiveTheme === 'dark' ? 'hsl(220 8% 26%)' : 'hsl(221.2 83.2% 53.3%)',
              color: 'white',
              border: 'none'
            }}
            className="px-4 py-2 rounded-lg transition-colors flex items-center cursor-pointer"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Video
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Search Videos */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 rounded-lg pl-10 pr-4 py-2 text-sm border-0 focus:ring-2 focus:ring-ministry-steel focus:bg-white"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ministry-slate" />
          </div>
        </div>
        
        {/* Video Grid */}
        <div className="p-4">
          {filteredVideos.length === 0 ? (
            <div className="text-center py-12">
              <VideoIcon className="w-12 h-12 text-ministry-slate mx-auto mb-4" />
              <p className="text-ministry-slate mb-2">No videos found</p>
              <button 
                onClick={() => setShowUploadDialog(true)} 
                style={{
                  backgroundColor: effectiveTheme === 'dark' ? 'hsl(220 8% 26%)' : 'hsl(240 1.9608% 90%)',
                  color: effectiveTheme === 'dark' ? 'hsl(0 0% 95%)' : 'hsl(210 25% 7.8431%)',
                  borderColor: effectiveTheme === 'dark' ? 'hsl(210 5.2632% 14.9020%)' : 'hsl(201.4286 30.4348% 90.9804%)'
                }}
                className="px-4 py-2 border rounded-lg transition-colors cursor-pointer"
              >
                Upload your first video
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((video: Video) => (
                <Card key={video.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-900 relative">
                    {video.thumbnailUrl ? (
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 space-y-1">
                      {getStatusBadge(video.processingStatus)}
                    </div>
                    <div className="absolute top-2 left-2 space-y-1">
                      {getTierBadge(video.requiredTier)}
                      {video.isFeatured && (
                        <Badge className="bg-yellow-100 text-yellow-800 flex items-center space-x-1">
                          <Star className="w-3 h-3" />
                          <span>Featured</span>
                        </Badge>
                      )}
                    </div>
                    {video.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>
                  
                  <CardContent className="p-4">
                    <h3 className="font-medium text-sm text-foreground truncate mb-2">
                      {video.title}
                    </h3>
                    <p className="text-xs text-ministry-slate mb-4 line-clamp-2">
                      {video.description || "No description"}
                    </p>
                    
                    <div className="flex flex-col space-y-3">
                      <div className="flex items-center space-x-3 text-xs text-ministry-slate">
                        <div className="flex items-center space-x-1">
                          <HardDrive className="w-3 h-3" />
                          <span>{formatFileSize(video.fileSize)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatLocalDateTime(video.createdAt).split(' ')[0]}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setSelectedVideo(video);
                          setIsWatchingVideo(false);
                          setShowVideoDialog(true);
                        }}
                        style={{
                          backgroundColor: effectiveTheme === 'dark' ? 'hsl(220 8% 26%)' : 'hsl(221.2 83.2% 53.3%)',
                          color: 'white',
                          border: 'none'
                        }}
                        className="w-full h-9 rounded-lg transition-colors text-xs cursor-pointer flex items-center justify-center"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Video</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!uploading ? (
              <>
                <div>
                  <Label htmlFor="video-file" className="text-sm font-medium">
                    Select Video File
                  </Label>
                  <Input
                    id="video-file"
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="mt-1"
                  />
                  <p className="text-xs text-ministry-slate mt-1">
                    Supported formats: MP4, MOV, AVI, etc. Max size: 100MB
                  </p>
                </div>
                
                {selectedFile && (
                  <>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-foreground mb-1">Selected File:</p>
                      <p className="text-sm text-ministry-slate">{selectedFile.name}</p>
                      <p className="text-xs text-ministry-slate">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    
                    <div>
                      <Label htmlFor="video-title" className="text-sm font-medium">
                        Video Title *
                      </Label>
                      <Input
                        id="video-title"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Enter video title"
                        className="mt-1"
                      />
                      {titleExists && (
                        <p className="text-red-500 text-sm mt-1">Title exists</p>
                      )}
                      {checkingTitle && (
                        <p className="text-muted-foreground text-sm mt-1">Checking title...</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="video-description" className="text-sm font-medium">
                        Description
                      </Label>
                      <Textarea
                        id="video-description"
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                        placeholder="Enter video description (optional)"
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="video-category" className="text-sm font-medium">
                        Category
                      </Label>
                      <Select value={uploadCategory} onValueChange={setUploadCategory}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="leadership">Leadership</SelectItem>
                          <SelectItem value="marriage">Marriage</SelectItem>
                          <SelectItem value="fatherhood">Fatherhood</SelectItem>
                          <SelectItem value="character">Character</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="video-tier" className="text-sm font-medium">
                        Access Tier
                      </Label>
                      <Select value={uploadTier} onValueChange={setUploadTier}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free - All users can access</SelectItem>
                          <SelectItem value="premium">Premium - Premium and VIP users only</SelectItem>
                          <SelectItem value="vip">VIP - VIP users only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <button 
                      onClick={handleUpload}
                      disabled={!uploadTitle.trim() || titleExists || checkingTitle}
                      style={{
                        backgroundColor: effectiveTheme === 'dark' ? 'hsl(220 8% 26%)' : 'hsl(221.2 83.2% 53.3%)',
                        color: 'white',
                        border: 'none',
                        opacity: (!uploadTitle.trim() || titleExists || checkingTitle) ? 0.5 : 1
                      }}
                      className="w-full px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Video
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-ministry-charcoal mb-2">Uploading video...</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-ministry-navy h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-ministry-slate mt-1">{Math.round(uploadProgress)}% complete</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Detail Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={(open) => {
        setShowVideoDialog(open);
        if (!open) setIsWatchingVideo(false);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <VideoIcon className="w-5 h-5" />
              <span>{selectedVideo?.title}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedVideo && (
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Video Preview */}
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                {isWatchingVideo ? (
                  <video 
                    src={`/api/videos/${selectedVideo.id}/stream`}
                    controls
                    className="w-full h-full object-contain"
                    onEnded={() => setIsWatchingVideo(false)}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="relative w-full h-full">
                    {selectedVideo.thumbnailUrl ? (
                      <img 
                        src={selectedVideo.thumbnailUrl} 
                        alt={selectedVideo.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <VideoIcon className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    <button
                      onClick={() => setIsWatchingVideo(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-all duration-200 group"
                    >
                      <div className="bg-white bg-opacity-90 rounded-full p-4 group-hover:bg-opacity-100 transition-all duration-200">
                        <Play className="w-8 h-8 text-gray-900 ml-1" />
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Video Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Title</Label>
                  <Input
                    value={selectedVideo.title}
                    onChange={(e) => {
                      setSelectedVideo(prev => prev ? { ...prev, title: e.target.value } : null);
                    }}
                  />
                  {titleExists && (
                    <p className="text-red-500 text-sm mt-1">Title exists</p>
                  )}
                  {checkingTitle && (
                    <p className="text-gray-500 text-sm mt-1">Checking title...</p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Category</Label>
                  <Select 
                    value={selectedVideo.category || 'general'} 
                    onValueChange={(value) => {
                      setSelectedVideo(prev => prev ? { ...prev, category: value } : null);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="leadership">Leadership</SelectItem>
                      <SelectItem value="marriage">Marriage</SelectItem>
                      <SelectItem value="fatherhood">Fatherhood</SelectItem>
                      <SelectItem value="character">Character</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Access Tier</Label>
                  <Select 
                    value={selectedVideo.requiredTier} 
                    onValueChange={(value) => {
                      setSelectedVideo(prev => prev ? { ...prev, requiredTier: value } : null);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free - All users can access</SelectItem>
                      <SelectItem value="premium">Premium - Premium and VIP users only</SelectItem>
                      <SelectItem value="vip">VIP - VIP users only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedVideo.processingStatus)}
                  </div>
                </div>
              </div>

              {/* Description Field */}
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={selectedVideo.description || ''}
                  onChange={(e) => {
                    setSelectedVideo(prev => prev ? { ...prev, description: e.target.value } : null);
                  }}
                  placeholder="Enter video description..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Featured Toggle */}
              <div 
                className="flex items-center justify-between p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-lg shadow-sm cursor-pointer hover:from-yellow-100 hover:to-orange-100 transition-all duration-200"
                onClick={() => {
                  setSelectedVideo(prev => prev ? { ...prev, isFeatured: !prev.isFeatured } : null);
                }}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {selectedVideo.isFeatured ? (
                      <Star className="w-8 h-8 text-yellow-500 fill-current" />
                    ) : (
                      <Star className="w-8 h-8 text-yellow-500" />
                    )}
                    <div>
                      <Label className="text-lg font-bold text-gray-900 cursor-pointer">Featured Video</Label>
                      <p className="text-sm text-gray-700 mt-1">Click the star to mark this video as featured</p>
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-600">
                  {selectedVideo.isFeatured ? 'Featured' : 'Not Featured'}
                </div>
              </div>

              {/* File Information */}
              <div className="grid grid-cols-2 gap-4 text-sm text-ministry-slate">
                <div>
                  <p className="font-medium text-ministry-charcoal">File Information</p>
                  <p>Size: {formatFileSize(selectedVideo.fileSize)}</p>
                  <p>Format: {selectedVideo.mimeType}</p>
                  {selectedVideo.duration && <p>Duration: {formatDuration(selectedVideo.duration)}</p>}
                </div>
                <div>
                  <p className="font-medium text-ministry-charcoal">Upload Details</p>
                  <p>Original: {selectedVideo.originalName}</p>
                  <p>Uploaded: {formatLocalDateTime(selectedVideo.createdAt)}</p>
                  <p>Modified: {formatLocalDateTime(selectedVideo.updatedAt)}</p>
                </div>
              </div>

              {/* Fixed Actions Bar */}
              <div className="flex-shrink-0 mt-6 pt-4 border-t bg-white">
              <div className="flex justify-between items-center">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedVideo && confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
                      deleteVideo.mutate(selectedVideo.id);
                    }
                  }}
                  disabled={deleteVideo.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteVideo.isPending ? 'Deleting...' : 'Delete Video'}
                </Button>

                <Button
                  onClick={() => {
                    if (selectedVideo) {
                      updateVideo.mutate({ 
                        id: selectedVideo.id, 
                        video: {
                          title: selectedVideo.title,
                          description: selectedVideo.description,
                          category: selectedVideo.category,
                          requiredTier: selectedVideo.requiredTier,
                          isFeatured: selectedVideo.isFeatured
                        }
                      });
                    }
                  }}
                  disabled={updateVideo.isPending || titleExists || checkingTitle}
                  className="bg-ministry-navy hover:bg-ministry-charcoal text-white px-8 py-2 font-bold text-sm disabled:opacity-50"
                >
                  {updateVideo.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}