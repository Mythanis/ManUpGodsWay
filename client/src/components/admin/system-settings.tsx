import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Video, Home, Shield } from "lucide-react";

interface SystemSettings {
  id: string;
  homepageTagline: string;
  warGroupsVideoUrl: string | null;
  warGroupsVideoTitle: string | null;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function SystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tagline, setTagline] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");

  // Fetch system settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['api', 'system-settings'],
    queryFn: () => fetch('/api/system-settings').then(res => res.json()) as Promise<SystemSettings>
  });

  // Update homepage tagline mutation
  const updateTaglineMutation = useMutation({
    mutationFn: (data: { homepageTagline: string }) =>
      fetch('/api/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'system-settings'] });
      toast({
        title: "Success",
        description: "Homepage tagline updated successfully"
      });
    },
    onError: (error: any) => {
      console.error("Error updating system settings:", error);
      toast({
        title: "Error", 
        description: error.message || "Failed to update settings",
        variant: "destructive"
      });
    }
  });

  // Update war groups video mutation
  const updateVideoMutation = useMutation({
    mutationFn: (data: { warGroupsVideoUrl: string; warGroupsVideoTitle: string }) =>
      fetch('/api/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'system-settings'] });
      toast({
        title: "Success",
        description: "War Groups video updated successfully"
      });
    },
    onError: (error: any) => {
      console.error("Error updating video settings:", error);
      toast({
        title: "Error", 
        description: error.message || "Failed to update video settings",
        variant: "destructive"
      });
    }
  });

  // Initialize values when settings load
  React.useEffect(() => {
    if (settings) {
      if (settings.homepageTagline && tagline !== settings.homepageTagline) {
        setTagline(settings.homepageTagline);
      }
      if (settings.warGroupsVideoUrl !== undefined && videoUrl !== (settings.warGroupsVideoUrl || "")) {
        setVideoUrl(settings.warGroupsVideoUrl || "");
      }
      if (settings.warGroupsVideoTitle !== undefined && videoTitle !== (settings.warGroupsVideoTitle || "")) {
        setVideoTitle(settings.warGroupsVideoTitle || "Welcome to War Groups");
      }
    }
  }, [settings]);

  const handleTaglineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagline.trim()) {
      toast({
        title: "Error",
        description: "Homepage tagline cannot be empty",
        variant: "destructive"
      });
      return;
    }
    updateTaglineMutation.mutate({ homepageTagline: tagline });
  };

  const handleVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateVideoMutation.mutate({ 
      warGroupsVideoUrl: videoUrl.trim(),
      warGroupsVideoTitle: videoTitle.trim() || "Welcome to War Groups"
    });
  };

  // Helper to extract YouTube embed URL
  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    // Handle various YouTube URL formats
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(youtubeRegex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    // Handle Vimeo
    const vimeoRegex = /vimeo\.com\/(?:.*\/)?(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    // Return as-is if already an embed URL or other format
    return url;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-ministry-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-ministry-charcoal mb-4">System Settings</h2>
      
      {/* Homepage Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-ministry-gold" />
            <CardTitle>Homepage Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTaglineSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tagline">Homepage Tagline</Label>
              <Textarea
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Enter the tagline that will appear on all users' homepage"
                rows={3}
                className="resize-none"
                data-testid="input-homepage-tagline"
              />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This message will appear on the homepage for all users.
              </p>
            </div>

            <Button 
              type="submit" 
              disabled={updateTaglineMutation.isPending || tagline === settings?.homepageTagline}
              className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
              data-testid="button-update-tagline"
            >
              {updateTaglineMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                "Update Tagline"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* War Groups Video Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-ministry-gold" />
            <div>
              <CardTitle>War Groups Explainer Video</CardTitle>
              <CardDescription>
                Add a video to the War Groups welcome page to explain what War Groups are about
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVideoSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="videoTitle">Video Title</Label>
              <Input
                id="videoTitle"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Welcome to War Groups"
                data-testid="input-video-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoUrl">Video URL</Label>
              <Input
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or Vimeo URL"
                data-testid="input-video-url"
              />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Supports YouTube and Vimeo URLs. Leave empty to hide the video section.
              </p>
            </div>

            {/* Video Preview */}
            {videoUrl && getEmbedUrl(videoUrl) && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="aspect-video bg-black rounded-lg overflow-hidden border">
                  <iframe
                    src={getEmbedUrl(videoUrl) || ""}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Video Preview"
                  />
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={updateVideoMutation.isPending}
              className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
              data-testid="button-update-video"
            >
              {updateVideoMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                <>
                  <Video className="h-4 w-4 mr-2" />
                  Update Video
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
