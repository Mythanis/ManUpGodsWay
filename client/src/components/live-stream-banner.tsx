import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Radio, Play } from "lucide-react";
import { useLocation } from "wouter";

interface LiveStream {
  id: string;
  title: string;
  description?: string;
  status: string;
  muxPlaybackId?: string;
  viewCount: number;
}

export function LiveStreamBanner() {
  const [, navigate] = useLocation();

  const { data: stream } = useQuery<LiveStream | null>({
    queryKey: ["/api/live-streams/active"],
    refetchInterval: 30000,
  });

  if (!stream || stream.status !== "live") return null;

  return (
    <button
      onClick={() => navigate("/live")}
      className="w-full mb-4 block"
    >
      <div className="bg-red-950 border border-red-700 rounded-lg p-3 flex items-center gap-3">
        <div className="flex-shrink-0">
          <Badge className="bg-red-600 text-white animate-pulse text-xs">
            <Radio className="w-3 h-3 mr-1" />
            LIVE
          </Badge>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-white font-bold text-sm truncate">{stream.title}</p>
          {stream.description && (
            <p className="text-red-300 text-xs truncate mt-0.5">{stream.description}</p>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 text-red-400 text-xs font-bold">
          <Play className="w-3 h-3 fill-red-400" />
          Watch
        </div>
      </div>
    </button>
  );
}
