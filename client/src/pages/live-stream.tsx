import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Radio, Users, ArrowLeft } from "lucide-react";
import Hls from "hls.js";

interface LiveStream {
  id: string;
  title: string;
  description?: string;
  status: string;
  muxPlaybackId?: string;
  viewCount: number;
}

type PlayerStatus = "loading" | "playing" | "error";

function MuxPlayer({ playbackId }: { playbackId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const src = `https://stream.mux.com/${playbackId}.m3u8`;

    function tryLoad() {
      if (cancelled) return;
      hlsRef.current?.destroy();
      hlsRef.current = null;

      const video = videoRef.current;
      if (!video) return;

      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, manifestLoadingTimeOut: 10000 });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          setStatus("playing");
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (cancelled) return;
          if (data.fatal) {
            hls.destroy();
            // Retry in 10s — broadcaster may not be connected yet
            setStatus("error");
            retryRef.current = setTimeout(() => {
              if (!cancelled) {
                setStatus("loading");
                setRetryCount(c => c + 1);
              }
            }, 10000);
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        video.src = src;
        const onLoaded = () => { if (!cancelled) setStatus("playing"); };
        const onError = () => {
          if (cancelled) return;
          setStatus("error");
          retryRef.current = setTimeout(() => {
            if (!cancelled) {
              setStatus("loading");
              setRetryCount(c => c + 1);
            }
          }, 10000);
        };
        video.addEventListener("loadedmetadata", onLoaded, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.load();
      } else {
        setStatus("error");
      }
    }

    tryLoad();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      hlsRef.current?.destroy();
    };
  }, [playbackId, retryCount]);

  if (status === "error") {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg">
        <div className="text-center px-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000] mx-auto mb-3" />
          <p className="text-white font-bold mb-1">Waiting for Broadcast…</p>
          <p className="text-gray-400 text-sm">The host is setting up. Retrying automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-lg bg-black relative overflow-hidden">
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000] mb-3" />
          <p className="text-gray-400 text-sm">Connecting to stream…</p>
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        style={{ display: status === "playing" ? "block" : "none" }}
        controls={status === "playing"}
        playsInline
        poster={status === "playing" ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : undefined}
      />
    </div>
  );
}

export default function LiveStreamPage() {
  const { data: stream, isLoading, isError } = useQuery<LiveStream | null>({
    queryKey: ["/api/live-streams/active"],
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => window.history.back()} className="text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-black uppercase tracking-wide">Live Stream</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FCD000]" />
        </div>
      </div>
    );
  }

  if (isError || !stream || stream.status !== "live") {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => window.history.back()} className="text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-black uppercase tracking-wide">Live Stream</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <Radio className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-white font-bold text-lg mb-2">No Live Stream Active</p>
            <p className="text-gray-400 text-sm">Check back when a broadcast is scheduled.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => window.history.back()} className="text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-black uppercase tracking-wide text-sm truncate">{stream.title}</h1>
        </div>
        <Badge className="bg-red-600 text-white animate-pulse text-xs flex-shrink-0">
          <Radio className="w-3 h-3 mr-1" />
          LIVE
        </Badge>
      </div>

      <div className="px-4">
        {stream.muxPlaybackId ? (
          <MuxPlayer playbackId={stream.muxPlaybackId} />
        ) : (
          <div className="w-full aspect-video bg-black rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Radio className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Stream starting…</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 pb-safe">
        <div className="flex items-center gap-2 mb-2">
          <Badge className="bg-red-600 text-white text-xs">🔴 LIVE NOW</Badge>
          {stream.viewCount > 0 && (
            <span className="flex items-center gap-1 text-gray-400 text-xs">
              <Users className="w-3 h-3" />
              {stream.viewCount} watching
            </span>
          )}
        </div>
        <h2 className="text-white font-black text-lg uppercase tracking-tight">{stream.title}</h2>
        {stream.description && (
          <p className="text-gray-400 text-sm mt-1">{stream.description}</p>
        )}
      </div>
    </div>
  );
}
