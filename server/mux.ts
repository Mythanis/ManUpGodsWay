import Mux from "@mux/mux-node";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export const RTMP_BASE_URL = "rtmps://global-live.mux.com:443/app";

export interface CreateMuxStreamOptions {
  simulcastYoutubeKey?: string;
  simulcastFacebookKey?: string;
}

export interface MuxStreamResult {
  muxStreamId: string;
  muxStreamKey: string;
  muxRtmpUrl: string;
  muxPlaybackId: string;
}

export async function createMuxLiveStream(options: CreateMuxStreamOptions = {}): Promise<MuxStreamResult> {
  const simulcastTargets: any[] = [];

  if (options.simulcastYoutubeKey) {
    simulcastTargets.push({
      url: "rtmp://a.rtmp.youtube.com/live2",
      stream_key: options.simulcastYoutubeKey,
      passthrough: "youtube",
    });
  }

  if (options.simulcastFacebookKey) {
    simulcastTargets.push({
      url: "rtmps://live-api-s.facebook.com:443/rtmp/",
      stream_key: options.simulcastFacebookKey,
      passthrough: "facebook",
    });
  }

  const params: any = {
    playback_policy: ["public"],
    new_asset_settings: { playback_policy: ["public"] },
    reconnect_window: 60,
    latency_mode: "low",
  };

  if (simulcastTargets.length > 0) {
    params.simulcast_targets = simulcastTargets;
  }

  const stream = await mux.video.liveStreams.create(params);

  const playbackId = stream.playback_ids?.[0]?.id;
  if (!playbackId) throw new Error("No playback ID returned from Mux");

  return {
    muxStreamId: stream.id,
    muxStreamKey: stream.stream_key,
    muxRtmpUrl: `${RTMP_BASE_URL}/${stream.stream_key}`,
    muxPlaybackId: playbackId,
  };
}

export async function disableMuxLiveStream(muxStreamId: string): Promise<void> {
  await mux.video.liveStreams.disable(muxStreamId);
}

export async function deleteMuxLiveStream(muxStreamId: string): Promise<void> {
  try {
    await mux.video.liveStreams.delete(muxStreamId);
  } catch (err) {
    console.error("Error deleting Mux stream (may already be deleted):", err);
  }
}

export function getMuxPlaybackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export function getMuxThumbnailUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg`;
}

/**
 * Returns the Mux live stream status: "active" means broadcaster is connected,
 * "idle" means no broadcaster. Returns null on any error.
 */
export async function getMuxLiveStreamStatus(muxStreamId: string): Promise<"active" | "idle" | null> {
  try {
    const stream = await mux.video.liveStreams.retrieve(muxStreamId);
    return (stream.status as "active" | "idle") ?? "idle";
  } catch {
    return null;
  }
}
