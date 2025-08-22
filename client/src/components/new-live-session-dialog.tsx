import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Radio, 
  ExternalLink, 
  Tv, 
  AlertCircle,
  Calendar,
  Clock
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function NewLiveSessionDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "general",
    type: "video" as "audio" | "video",
    liveUrl: "",
    scheduledDate: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createLiveSessionMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/admin/live-sessions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/podcasts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/podcasts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/livestreams'] });
      toast({
        title: "Live Session Started!",
        description: "Your live session is now active and users will be notified."
      });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start live session",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "general",
      type: "video",
      liveUrl: "",
      scheduledDate: ""
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the live session",
        variant: "destructive"
      });
      return;
    }

    if (!formData.liveUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter the Riverside stream URL",
        variant: "destructive"
      });
      return;
    }

    createLiveSessionMutation.mutate(formData);
  };

  const generateDefaultTitle = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Live Session - ${dateStr} ${timeStr}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-white">
          <Radio className="w-4 h-4 mr-2" />
          Create New Live Podcast
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Live Podcast Session</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium">Live Podcast Session Setup:</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-blue-700 mb-1">Before Going Live:</p>
                    <ol className="space-y-1 list-decimal ml-3">
                      <li>Fill out session details below</li>
                      <li>Open Riverside.fm Studio</li>
                      <li>Set up your recording/stream</li>
                      <li>Copy the viewer share URL</li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-medium text-green-700 mb-1">Going Live:</p>
                    <ol className="space-y-1 list-decimal ml-3">
                      <li>Paste Riverside URL below</li>
                      <li>Click "Start Live Session"</li>
                      <li>New podcast entry is created</li>
                      <li>Users get notified automatically</li>
                    </ol>
                  </div>
                </div>
                <div className="bg-yellow-50 p-2 rounded text-xs">
                  <strong>Important:</strong> This creates a new podcast that will appear in your podcast library. You can edit the title and details after the session ends.
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 mb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open('https://riverside.fm/studio', '_blank')}
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Riverside.fm
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData(prev => ({ ...prev, title: generateDefaultTitle() }))}
            >
              <Clock className="w-4 h-4 mr-2" />
              Auto-Generate Title
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Session Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Men's Leadership Discussion"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="type">Content Type</Label>
                <Select value={formData.type} onValueChange={(value: "audio" | "video") => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">
                      <div className="flex items-center">
                        <Tv className="w-4 h-4 mr-2" />
                        Video
                      </div>
                    </SelectItem>
                    <SelectItem value="audio">
                      <div className="flex items-center">
                        <Radio className="w-4 h-4 mr-2" />
                        Audio
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of what this live session will cover..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="marriage">Marriage</SelectItem>
                    <SelectItem value="fatherhood">Fatherhood</SelectItem>
                    <SelectItem value="character">Character</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="scheduledDate">Scheduled Date (Optional)</Label>
                <Input
                  id="scheduledDate"
                  type="datetime-local"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="liveUrl">Riverside Stream URL *</Label>
              <Input
                id="liveUrl"
                value={formData.liveUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, liveUrl: e.target.value }))}
                placeholder="https://riverside.fm/studio/..."
                className="mt-1"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                The URL users will use to join your live stream
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createLiveSessionMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {createLiveSessionMutation.isPending ? "Starting..." : "Start Live Session"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}