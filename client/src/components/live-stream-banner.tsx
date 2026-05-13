import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Radio, Play, X } from "lucide-react";
import { useLocation } from "wouter";

interface LiveStream {
  id: string;
  title: string;
  description?: string;
  status: string;
  muxPlaybackId?: string;
  viewCount: number;
}

function getDismissedStreams(): string[] {
  try {
    return JSON.parse(localStorage.getItem("dismissed_live_streams") || "[]");
  } catch {
    return [];
  }
}

function persistDismiss(id: string) {
  const current = getDismissedStreams();
  if (!current.includes(id)) {
    localStorage.setItem("dismissed_live_streams", JSON.stringify([...current, id]));
  }
}

export function LiveStreamBanner() {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(getDismissedStreams());
  }, []);

  const { data: stream } = useQuery<LiveStream | null>({
    queryKey: ["/api/live-streams/active"],
  });

  if (!stream || stream.status !== "live") return null;
  if (dismissed.includes(stream.id)) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    persistDismiss(stream.id);
    setDismissed(prev => [...prev, stream.id]);
  };

  return (
    <div className="w-full mb-4 relative">
      <button
        onClick={() => navigate("/live")}
        className="w-full block"
      >
        <div className="bg-red-950 border border-red-700 rounded-lg p-3 flex items-center gap-3 pr-10">
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
          <div className="flex-shrink-0 flex items-center gap-1 text-red-400 text-xs font-bold mr-1">
            <Play className="w-3 h-3 fill-red-400" />
            Watch
          </div>
        </div>
      </button>
      <button
        onClick={handleDismiss}
        className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-red-400 hover:text-white hover:bg-red-800 rounded-full transition-colors z-10"
        aria-label="Dismiss live banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
