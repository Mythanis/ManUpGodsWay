import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import { Search, Upload, Play, Trash2, Eye, Edit, Video as VideoIcon, FileText, Clock, HardDrive, Crown, Gem, Zap } from "lucide-react";

interface Video {
  id: string;
  title: string;
  description?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  duration?: number;
  thumbnailUrl?: string;
  uploadedBy: string;
  requiredTier: string;
  isProcessed: boolean;
  processingStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function VideoManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadTier, setUploadTier] = useState('free');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["/api/admin/videos"],
    retry: false,
  });

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
      toast({
        title: "Success",
        description: "Video uploaded successfully!",
      });
    },
    onError: (error: any) => {
      setUploading(false);
      setUploadProgress(0);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload video. Please try again.",
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
      toast({
        title: "Success",
        description: "Video updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update video. Please try again.",
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
      toast({
        title: "Success",
        description: "Video deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete video. Please try again.",
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
          <Badge className="bg-gray-100 text-gray-800 flex items-center space-x-1">
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
          <Button onClick={() => setShowUploadDialog(true)} className="bg-ministry-navy hover:bg-ministry-navy/90">
            <Upload className="w-4 h-4 mr-2" />
            Upload Video
          </Button>
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
              <Button onClick={() => setShowUploadDialog(true)} variant="outline">
                Upload your first video
              </Button>
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
                    <div className="absolute top-2 left-2">
                      {getTierBadge(video.requiredTier)}
                    </div>
                    {video.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>
                  
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm text-ministry-charcoal truncate mb-1">
                      {video.title}
                    </h3>
                    <p className="text-xs text-ministry-slate mb-3 line-clamp-2">
                      {video.description || "No description"}
                    </p>
                    
                    <div className="flex items-center justify-between">
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
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedVideo(video);
                          setShowVideoDialog(true);
                        }}
                        className="h-7 text-xs"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
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
                      <p className="text-sm font-medium text-ministry-charcoal mb-1">Selected File:</p>
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
                    
                    <Button 
                      onClick={handleUpload}
                      disabled={!uploadTitle.trim()}
                      className="w-full bg-ministry-navy hover:bg-ministry-charcoal"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Video
                    </Button>
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
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <VideoIcon className="w-5 h-5" />
              <span>{selectedVideo?.title}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedVideo && (
            <div className="space-y-6">
              {/* Video Preview */}
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                {selectedVideo.thumbnailUrl ? (
                  <img 
                    src={selectedVideo.thumbnailUrl} 
                    alt={selectedVideo.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-16 h-16 text-gray-400" />
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
                    className="mt-1"
                  />
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

              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={selectedVideo.description || ""}
                  onChange={(e) => {
                    setSelectedVideo(prev => prev ? { ...prev, description: e.target.value } : null);
                  }}
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Video Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-ministry-charcoal">File Details</p>
                  <div className="space-y-1 text-ministry-slate">
                    <p>Original Name: {selectedVideo.originalName}</p>
                    <p>File Size: {formatFileSize(selectedVideo.fileSize)}</p>
                    <p>Type: {selectedVideo.mimeType}</p>
                    {selectedVideo.duration && <p>Duration: {formatDuration(selectedVideo.duration)}</p>}
                  </div>
                </div>
                
                <div>
                  <p className="font-medium text-ministry-charcoal">Upload Info</p>
                  <div className="space-y-1 text-ministry-slate">
                    <p>Uploaded: {formatLocalDateTime(selectedVideo.createdAt)}</p>
                    <p>Modified: {formatLocalDateTime(selectedVideo.updatedAt)}</p>
                    <p>Processed: {selectedVideo.isProcessed ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => deleteVideo.mutate(selectedVideo.id)}
                  disabled={deleteVideo.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Video
                </Button>
                
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowVideoDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      updateVideo.mutate({ 
                        id: selectedVideo.id, 
                        video: {
                          title: selectedVideo.title,
                          description: selectedVideo.description,
                          requiredTier: selectedVideo.requiredTier
                        }
                      });
                    }}
                    disabled={updateVideo.isPending}
                  >
                    Save Changes
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