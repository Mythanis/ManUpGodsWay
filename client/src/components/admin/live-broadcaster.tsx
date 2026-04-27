import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Radio, VideoOff, Video, Mic, MicOff, Square, AlertTriangle } from "lucide-react";

interface LiveBroadcasterProps {
  streamKey: string;
  streamId: string;
  onBroadcastStart?: () => void;
  onBroadcastEnd?: () => void;
}

type BroadcastState = "idle" | "requesting" | "connecting" | "live" | "error";

export function LiveBroadcaster({ streamKey, streamId, onBroadcastStart, onBroadcastEnd }: LiveBroadcasterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<BroadcastState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  useEffect(() => {
    if (state === "live") {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  function stopAll() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function getMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    return stream;
  }

  async function startBroadcast() {
    setErrorMsg("");
    setState("requesting");

    let media: MediaStream;
    try {
      media = await getMedia();
    } catch (err: any) {
      setErrorMsg("Camera/mic permission denied. Please allow access and try again.");
      setState("error");
      return;
    }

    streamRef.current = media;
    if (videoRef.current) {
      videoRef.current.srcObject = media;
      videoRef.current.muted = true;
    }

    setState("connecting");

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      media.getTracks().forEach(track => pc.addTrack(track, media));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering (max 4s)
      await new Promise<void>(resolve => {
        if (pc.iceGatheringState === "complete") { resolve(); return; }
        const done = () => { if (pc.iceGatheringState === "complete") resolve(); };
        pc.addEventListener("icegatheringstatechange", done);
        setTimeout(resolve, 4000);
      });

      const sdpBody = pc.localDescription?.sdp;

      // Try server proxy first, then fall back to direct browser→Mux if proxy fails
      let answerSdp: string | null = null;

      // Attempt 1: server proxy
      try {
        const proxyResp = await fetch(`/api/live-streams/${streamId}/whip`, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: sdpBody,
        });
        if (proxyResp.ok) {
          answerSdp = await proxyResp.text();
        } else {
          console.warn("WHIP proxy failed, trying direct connection…");
        }
      } catch (proxyErr: any) {
        console.warn("WHIP proxy network error, trying direct connection…", proxyErr?.message);
      }

      // Attempt 2: direct browser → Mux (if proxy failed)
      if (!answerSdp) {
        let whipUrl: string;
        try {
          const urlResp = await fetch(`/api/live-streams/${streamId}/whip-url`);
          if (!urlResp.ok) throw new Error("Could not get WHIP URL");
          const data = await urlResp.json();
          whipUrl = data.whipUrl;
        } catch {
          throw new Error("Could not connect to the streaming server. Use OBS or Riverside with the RTMP credentials shown below to go live instead.");
        }

        let directResp: Response;
        try {
          directResp = await fetch(whipUrl, {
            method: "POST",
            headers: { "Content-Type": "application/sdp" },
            body: sdpBody,
          });
        } catch (directErr: any) {
          throw new Error("Could not connect to the streaming server. Use OBS or Riverside with the RTMP credentials shown below to go live instead.");
        }

        if (!directResp.ok) {
          const text = await directResp.text().catch(() => "");
          throw new Error(`Streaming server rejected the connection (${directResp.status}). ${text ? text + ". " : ""}Use OBS or Riverside with the RTMP credentials shown below to go live instead.`);
        }
        answerSdp = await directResp.text();
      }
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setErrorMsg("Connection dropped. Please try again.");
          setState("error");
          stopAll();
          onBroadcastEnd?.();
        }
      };

      setState("live");
      onBroadcastStart?.();
    } catch (err: any) {
      console.error("WHIP error:", err);
      setErrorMsg(err.message || "Failed to connect to Mux. Check your stream settings.");
      setState("error");
      stopAll();
    }
  }

  async function stopBroadcast() {
    stopAll();
    setState("idle");
    onBroadcastEnd?.();
  }

  function toggleMic() {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  }

  function toggleCam() {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCamOn(videoTrack.enabled);
    }
  }

  async function flipCamera() {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    if (state === "live" && streamRef.current) {
      const oldVideo = streamRef.current.getVideoTracks()[0];
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newVideoTrack);
      oldVideo.stop();
      streamRef.current.removeTrack(oldVideo);
      streamRef.current.addTrack(newVideoTrack);
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
    }
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div className="bg-gray-950 rounded-lg overflow-hidden">
      {/* Preview */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: state === "idle" || state === "error" ? "none" : "block", transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />
        {(state === "idle" || state === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Video className="w-10 h-10 text-gray-700 mb-2" />
            <p className="text-gray-500 text-sm">Camera preview will appear here</p>
          </div>
        )}
        {state === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FDD000] mb-3" />
            <p className="text-white text-sm font-bold">Connecting to Mux…</p>
          </div>
        )}
        {state === "live" && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <Badge className="bg-red-600 text-white animate-pulse text-xs">
              <Radio className="w-3 h-3 mr-1" />
              LIVE
            </Badge>
            <span className="text-white text-xs font-mono bg-black/50 px-2 py-0.5 rounded">
              {formatDuration(duration)}
            </span>
          </div>
        )}
        {state === "live" && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              onClick={toggleMic}
              className={`p-2 rounded-full ${micOn ? "bg-white/20" : "bg-red-600"}`}
            >
              {micOn ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4 text-white" />}
            </button>
            <button
              onClick={toggleCam}
              className={`p-2 rounded-full ${camOn ? "bg-white/20" : "bg-red-600"}`}
            >
              {camOn ? <Video className="w-4 h-4 text-white" /> : <VideoOff className="w-4 h-4 text-white" />}
            </button>
            <button
              onClick={flipCamera}
              className="p-2 rounded-full bg-white/20"
              title="Flip camera"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 7h-9m9 0-3-3m3 3-3 3M4 17h9m-9 0 3 3m-3-3 3-3" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-3">
        {state === "error" && errorMsg && (
          <div className="mb-3">
            <div className="flex items-start gap-2 bg-red-950 border border-red-700 rounded p-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs">{errorMsg}</p>
            </div>
          </div>
        )}

        {state === "requesting" && (
          <p className="text-gray-400 text-xs text-center mb-3">Allow camera and microphone access when prompted…</p>
        )}

        {(state === "idle" || state === "error") && (
          <Button
            onClick={startBroadcast}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
          >
            <Radio className="w-4 h-4 mr-2" />
            Start Live Broadcast
          </Button>
        )}

        {(state === "requesting" || state === "connecting") && (
          <Button disabled className="w-full bg-red-600/50 text-white font-bold">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            {state === "requesting" ? "Requesting camera…" : "Connecting…"}
          </Button>
        )}

        {state === "live" && (
          <Button
            onClick={stopBroadcast}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold"
          >
            <Square className="w-4 h-4 mr-2" />
            End Broadcast
          </Button>
        )}

        <p className="text-gray-600 text-xs text-center mt-2">
          Streams directly from your camera via WebRTC · Works on mobile
        </p>
      </div>
    </div>
  );
}
