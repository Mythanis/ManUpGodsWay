import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NewLiveSessionDialog } from "@/components/new-live-session-dialog";
import { 
  Radio, 
  ExternalLink, 
  Tv, 
  Clock, 
  Users, 
  Eye,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

interface Podcast {
  id: string;
  title: string;
  description?: string;
  isLive: boolean;
  liveUrl?: string;
  viewCount: number;
  category: string;
  type: 'audio' | 'video';
  liveStartedAt?: string;
  createdAt: string;
}

export function RiversideIntegrationPanel() {
  const { data: podcasts = [], isLoading } = useQuery<Podcast[]>({
    queryKey: ['/api/admin/podcasts'],
    refetchInterval: 10000, // Refresh every 10 seconds for real-time updates
  });

  const { data: liveStreams = [] } = useQuery<Podcast[]>({
    queryKey: ['/api/livestreams'],
    refetchInterval: 5000, // More frequent updates for live streams
  });

  const formatTimeElapsed = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    }
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Tv className="w-5 h-5 text-ministry-gold" />
            <span>Riverside.fm Integration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Tv className="w-5 h-5 text-ministry-gold" />
            <span>Live Podcast Management</span>
          </div>
          <Button
            variant="outline"
            onClick={() => window.open('https://riverside.fm/studio', '_blank')}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Riverside Studio
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live Streams Status */}
        {liveStreams.length > 0 && (
          <div>
            <h3 className="font-medium text-ministry-charcoal mb-3 flex items-center">
              <Radio className="w-4 h-4 mr-2 text-red-500" />
              Currently Live ({liveStreams.length})
            </h3>
            <div className="space-y-3">
              {liveStreams.map((stream) => (
                <Alert key={stream.id} className="border-red-200 bg-red-50">
                  <CheckCircle2 className="h-4 w-4 text-red-500" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{stream.title}</span>
                        <div className="text-xs text-muted-foreground mt-1">
                          Live for {formatTimeElapsed(stream.liveStartedAt!)} • {stream.viewCount} viewers
                        </div>
                      </div>
                      <Badge className="bg-red-500 text-white">
                        LIVE
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Setup Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <p className="font-medium">How to Start a New Live Podcast Session:</p>
              <ol className="text-sm space-y-2 list-decimal ml-4">
                <li><strong>Prepare Your Session:</strong> Click "Start New Live Session" below to set up your podcast details (title, description, category)</li>
                <li><strong>Open Riverside:</strong> Click the "Open Riverside.fm" button to launch the streaming platform in a new tab</li>
                <li><strong>Start Recording:</strong> Begin your recording/live stream in Riverside Studio</li>
                <li><strong>Get Share URL:</strong> Copy the viewer/share URL from Riverside (this is what users will use to join)</li>
                <li><strong>Go Live:</strong> Return here, paste the URL, and click "Start Live Session"</li>
                <li><strong>Automatic Setup:</strong> A new podcast entry is created and users are notified automatically</li>
              </ol>
              <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-black">
                <strong>Note:</strong> Each live session becomes a permanent podcast entry that you can edit later. The recording will be saved to your podcast library after the stream ends.
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Start New Live Podcast */}
        <div>
          <h3 className="font-medium text-ministry-charcoal mb-3 flex items-center">
            <Radio className="w-4 h-4 mr-2 text-ministry-gold" />
            Create New Live Podcast Session
          </h3>
          <NewLiveSessionDialog />
          <p className="text-xs text-ministry-slate mt-2">
            Each live session creates a new podcast entry that will be saved to your library after streaming.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-ministry-charcoal">
              {liveStreams.length}
            </div>
            <div className="text-sm text-ministry-slate">Active Streams</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-ministry-charcoal">
              {liveStreams.reduce((sum, stream) => sum + stream.viewCount, 0)}
            </div>
            <div className="text-sm text-ministry-slate">Total Viewers</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}