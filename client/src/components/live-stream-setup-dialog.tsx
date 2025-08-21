import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Radio, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LiveStreamSetupDialogProps {
  podcastId: string;
  podcastTitle: string;
  isLive?: boolean;
}

export function LiveStreamSetupDialog({ podcastId, podcastTitle, isLive }: LiveStreamSetupDialogProps) {
  const [open, setOpen] = useState(false);
  const [liveUrl, setLiveUrl] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startLiveStreamMutation = useMutation({
    mutationFn: async (data: { liveUrl: string }) => {
      return apiRequest('POST', `/api/admin/livestream/start/${podcastId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/podcasts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/livestreams'] });
      toast({
        title: "Live Stream Started",
        description: "Users will be notified that the stream is now live!"
      });
      setOpen(false);
      setLiveUrl("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start live stream",
        variant: "destructive"
      });
    }
  });

  const endLiveStreamMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/admin/livestream/end/${podcastId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/podcasts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/livestreams'] });
      toast({
        title: "Live Stream Ended",
        description: "The live stream has been stopped."
      });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to end live stream",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter the Riverside stream URL",
        variant: "destructive"
      });
      return;
    }
    startLiveStreamMutation.mutate({ liveUrl: liveUrl.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isLive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => endLiveStreamMutation.mutate()}
            disabled={endLiveStreamMutation.isPending}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            End Live
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 border-green-200 hover:bg-green-50"
          >
            <Radio className="w-4 h-4 mr-1" />
            Go Live
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Start Live Stream for "{podcastTitle}"</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Setup Instructions:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal ml-4">
              <li>Open Riverside.fm and start your recording/live stream</li>
              <li>Copy the share/view URL from Riverside</li>
              <li>Paste it below to make it available to users</li>
              <li>Click "Start Live Stream" to notify users</li>
            </ol>
          </div>

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
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="liveUrl">Riverside Stream URL</Label>
              <Input
                id="liveUrl"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://riverside.fm/studio/..."
                className="mt-1"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                This URL will be shared with users to join the live stream
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={startLiveStreamMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {startLiveStreamMutation.isPending ? "Starting..." : "Start Live Stream"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}