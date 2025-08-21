import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Radio, ExternalLink, Clock } from "lucide-react";

interface LiveStream {
  id: string;
  title: string;
  description?: string;
  liveUrl?: string;
  viewCount: number;
  type: 'audio' | 'video';
  category: string;
}

export function LiveStreamBanner() {
  const { data: liveStreams, isLoading } = useQuery<LiveStream[]>({
    queryKey: ['/api/livestreams'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !liveStreams || liveStreams.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Badge className="bg-red-500 hover:bg-red-600 text-white animate-pulse">
                  <Radio className="w-3 h-3 mr-1" />
                  LIVE NOW
                </Badge>
                <h3 className="font-semibold text-lg text-ministry-charcoal">
                  {liveStreams[0].title}
                </h3>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-sm text-ministry-slate">
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {liveStreams[0].viewCount} watching
                </span>
              </div>
              
              <Button
                onClick={() => window.open(liveStreams[0].liveUrl, '_blank')}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Join Live
              </Button>
            </div>
          </div>
          
          {liveStreams[0].description && (
            <p className="text-ministry-slate text-sm mt-2 line-clamp-1">
              {liveStreams[0].description}
            </p>
          )}
        </CardContent>
      </Card>
      
      {liveStreams.length > 1 && (
        <div className="mt-2 text-sm text-ministry-slate text-center">
          +{liveStreams.length - 1} more live stream{liveStreams.length > 2 ? 's' : ''} available
        </div>
      )}
    </div>
  );
}