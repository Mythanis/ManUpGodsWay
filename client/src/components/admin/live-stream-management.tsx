import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Radio, Plus, Square, Trash2, Copy, Check, ChevronDown, ChevronUp, Tv, Smartphone, Monitor, Film } from "lucide-react";
import { z } from "zod";
import { LiveBroadcaster } from "./live-broadcaster";

const createLiveStreamSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  simulcastYoutubeKey: z.string().optional(),
  simulcastFacebookKey: z.string().optional(),
});

type Tab = "app" | "riverside" | "obs";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-[#FCD000] hover:text-yellow-300 transition-colors flex-shrink-0">
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-center justify-between bg-black rounded p-2 gap-2">
        <code className="text-green-400 text-xs truncate flex-1">{value}</code>
        <CopyButton value={value} label="Copy" />
      </div>
    </div>
  );
}

function SetupGuide({ stream, onGoLive, onEndStream, goLivePending, endPending }: {
  stream: any;
  onGoLive: () => void;
  onEndStream: () => void;
  goLivePending: boolean;
  endPending: boolean;
}) {
  const [tab, setTab] = useState<Tab>("app");

  const rtmpServer = "rtmps://global-live.mux.com:443/app";
  const streamKey = stream.muxStreamKey || "";

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: "app", icon: Smartphone, label: "In-App" },
    { id: "riverside", icon: Monitor, label: "Riverside" },
    { id: "obs", icon: Tv, label: "OBS / Other" },
  ];

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden mt-3">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              tab === t.id
                ? "text-[#FCD000] border-b-2 border-[#FCD000] bg-black/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <t.icon className="w-3 h-3" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3">
        {/* IN-APP TAB */}
        {tab === "app" && (
          <div className="space-y-3">
            <p className="text-gray-400 text-xs">Go live directly from your phone or browser camera — no extra apps needed.</p>

            {stream.status === "scheduled" && (
              <Button onClick={onGoLive} disabled={goLivePending} size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold">
                🔴 {goLivePending ? "Starting…" : "Mark as Live First"}
              </Button>
            )}

            {stream.status === "live" ? (
              <>
                <LiveBroadcaster
                  streamKey={streamKey}
                  onBroadcastEnd={onEndStream}
                />
              </>
            ) : (
              <div className="bg-black/50 rounded p-3 text-center">
                <Smartphone className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-xs">Click "Mark as Live First" above, then the camera broadcaster will appear here.</p>
              </div>
            )}
          </div>
        )}

        {/* RIVERSIDE TAB */}
        {tab === "riverside" && (
          <div className="space-y-3">
            <div className="bg-[#FCD000]/10 border border-[#FCD000]/30 rounded p-2">
              <p className="text-[#FCD000] text-xs font-bold mb-1">Using Riverside.fm</p>
              <p className="text-gray-300 text-xs">Riverside streams to your app via its custom RTMP output. High quality, browser-based — works from your phone or laptop.</p>
            </div>

            <div className="space-y-2">
              <p className="text-white text-xs font-bold uppercase tracking-wide">Steps:</p>
              <ol className="space-y-2 text-xs text-gray-400 list-decimal list-inside">
                <li>Open <span className="text-white font-semibold">Riverside.fm</span> and start or schedule a recording</li>
                <li>Click <span className="text-white font-semibold">Settings → Live Stream</span> (or the stream icon)</li>
                <li>Select <span className="text-white font-semibold">"Custom RTMP"</span> as the destination</li>
                <li>Paste the <span className="text-white font-semibold">RTMP Server URL</span> and <span className="text-white font-semibold">Stream Key</span> below</li>
                <li>Click <span className="text-white font-semibold">"Go Live"</span> in Riverside — your members watch it in the app</li>
              </ol>
            </div>

            <CodeRow label="RTMP Server URL" value={rtmpServer} />
            <CodeRow label="Stream Key" value={streamKey} />

            <p className="text-gray-600 text-[10px]">Also works with StreamYard, Ecamm Live, and any tool that supports custom RTMP.</p>
          </div>
        )}

        {/* OBS TAB */}
        {tab === "obs" && (
          <div className="space-y-3">
            <div className="bg-[#FCD000]/10 border border-[#FCD000]/30 rounded p-2">
              <p className="text-[#FCD000] text-xs font-bold mb-1">Using OBS Studio (Free, Desktop)</p>
              <p className="text-gray-300 text-xs">OBS gives you the most control — scene switching, overlays, multiple cameras. Download free at obsproject.com.</p>
            </div>

            <div className="space-y-2">
              <p className="text-white text-xs font-bold uppercase tracking-wide">OBS Setup Steps:</p>
              <ol className="space-y-2 text-xs text-gray-400 list-decimal list-inside">
                <li>Open OBS → click <span className="text-white font-semibold">Settings</span> (bottom right)</li>
                <li>Click <span className="text-white font-semibold">Stream</span> in the left sidebar</li>
                <li>Set Service to <span className="text-white font-semibold">"Custom…"</span></li>
                <li>Paste the <span className="text-white font-semibold">Server URL</span> below into the Server field</li>
                <li>Paste the <span className="text-white font-semibold">Stream Key</span> into the Stream Key field</li>
                <li>Click <span className="text-white font-semibold">OK</span>, then <span className="text-white font-semibold">"Start Streaming"</span> in OBS</li>
              </ol>
            </div>

            <CodeRow label="Server URL" value={rtmpServer} />
            <CodeRow label="Stream Key" value={streamKey} />

            <div className="border-t border-gray-800 pt-2">
              <p className="text-white text-xs font-bold uppercase tracking-wide mb-2">Mobile RTMP Apps:</p>
              <div className="space-y-1 text-xs text-gray-400">
                <p>• <span className="text-white font-semibold">Larix Broadcaster</span> (iOS & Android, free) — most popular</p>
                <p>• <span className="text-white font-semibold">Streamlabs Mobile</span> (iOS & Android, free)</p>
                <p>Use the same Server URL and Stream Key above in any of these apps.</p>
              </div>
            </div>

            {stream.simulcastYoutubeKey || stream.simulcastFacebookKey ? (
              <div className="border-t border-gray-800 pt-2">
                <p className="text-[#FCD000] text-xs font-bold uppercase tracking-wide mb-1">Simulcasting Active:</p>
                {stream.simulcastYoutubeKey && <p className="text-gray-400 text-xs">✓ YouTube — broadcast appears there too</p>}
                {stream.simulcastFacebookKey && <p className="text-gray-400 text-xs">✓ Facebook — broadcast appears there too</p>}
              </div>
            ) : null}
          </div>
        )}

        {/* End stream button */}
        {stream.status === "live" && tab !== "app" && (
          <Button onClick={onEndStream} disabled={endPending} size="sm" variant="outline" className="w-full border-gray-600 text-gray-300 text-xs">
            <Square className="w-3 h-3 mr-1" />
            {endPending ? "Ending…" : "End Stream"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LiveStreamManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: liveStreams = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/live-streams"],
  });

  const form = useForm({
    resolver: zodResolver(createLiveStreamSchema),
    defaultValues: { title: "", description: "", simulcastYoutubeKey: "", simulcastFacebookKey: "" },
  });

  const createStream = useMutation({
    mutationFn: async (data: z.infer<typeof createLiveStreamSchema>) => apiRequest("POST", "/api/live-streams", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams"] });
      toast({ title: "Stream Created", description: "Your stream is ready. Open the stream card to see how to connect and go live." });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message || "Failed to create stream", variant: "destructive" }),
  });

  const startStream = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/live-streams/${id}/start`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams/active"] });
      toast({ title: "Stream is Live", description: "Members can now see the live banner." });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message || "Failed", variant: "destructive" }),
  });

  const endStream = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/live-streams/${id}/end`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams/active"] });
      toast({ title: "Stream Ended", description: "The live banner has been removed." });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message || "Failed", variant: "destructive" }),
  });

  const deleteStream = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/live-streams/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams"] });
      toast({ title: "Deleted", description: "Stream deleted." });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message || "Failed", variant: "destructive" }),
  });

  const saveRecording = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/live-streams/${id}/save-recording`, {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      if (data?.message?.includes("processing")) {
        toast({ title: "Still Processing", description: "Mux is still encoding the recording. Try again in a few minutes.", variant: "destructive" });
      } else {
        toast({ title: "Recording Saved!", description: "The live stream recording has been added to Videos." });
      }
    },
    onError: (error: any) => toast({ title: "Error", description: error.message || "Failed to save recording", variant: "destructive" }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live": return <Badge className="bg-red-600 text-white animate-pulse">🔴 LIVE</Badge>;
      case "scheduled": return <Badge className="bg-blue-600 text-white">Ready</Badge>;
      case "ended": return <Badge className="bg-gray-600 text-white">Ended</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Streams</h2>
          <p className="text-gray-400 text-sm">Go live in the app from any device</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#FCD000] text-black hover:bg-yellow-400 font-bold" data-testid="button-create-stream">
              <Plus className="w-4 h-4 mr-2" />
              New Stream
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border border-gray-700 max-h-[85svh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">Create Live Stream</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createStream.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Sunday Service Live" className="bg-gray-800 border-gray-700 text-white" {...field} data-testid="input-stream-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="What is this stream about?" className="bg-gray-800 border-gray-700 text-white" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <div className="border border-gray-700 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-bold text-[#FCD000] uppercase tracking-wide">Simulcast (Optional)</p>
                  <p className="text-xs text-gray-400">Stream to YouTube and/or Facebook at the same time as the app.</p>
                  <FormField control={form.control} name="simulcastYoutubeKey" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 text-xs">YouTube Stream Key</FormLabel>
                      <FormControl>
                        <Input placeholder="xxxx-xxxx-xxxx-xxxx" className="bg-gray-800 border-gray-700 text-white text-sm" {...field} />
                      </FormControl>
                      <p className="text-xs text-gray-500">YouTube Studio → Go Live → Stream key</p>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="simulcastFacebookKey" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 text-xs">Facebook Stream Key</FormLabel>
                      <FormControl>
                        <Input placeholder="FB-xxxx..." className="bg-gray-800 border-gray-700 text-white text-sm" {...field} />
                      </FormControl>
                      <p className="text-xs text-gray-500">Facebook Live Producer → Stream setup → Stream key</p>
                    </FormItem>
                  )} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 border-gray-600 text-gray-300">Cancel</Button>
                  <Button type="submit" disabled={createStream.isPending} className="flex-1 bg-[#FCD000] text-black font-bold" data-testid="button-submit-stream">
                    {createStream.isPending ? "Creating…" : "Create Stream"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000] mx-auto mb-4" />
          <p className="text-gray-400">Loading streams…</p>
        </div>
      ) : liveStreams.length === 0 ? (
        <Card className="bg-black border border-gray-700">
          <CardContent className="py-8 text-center">
            <Radio className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No live streams yet</p>
            <p className="text-gray-500 text-sm">Click "New Stream" to create your first broadcast</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {liveStreams.map((stream: any) => (
            <Card key={stream.id} className="bg-black border border-gray-700" data-testid={`stream-card-${stream.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{stream.title}</h3>
                    {getStatusBadge(stream.status)}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {stream.status === "live" && (
                      <>
                        <button
                          onClick={() => setExpandedId(expandedId === stream.id ? null : stream.id)}
                          className="text-gray-400 text-xs flex items-center gap-1"
                        >
                          RTMP
                          {expandedId === stream.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <Button
                          size="sm"
                          onClick={() => endStream.mutate(stream.id)}
                          disabled={endStream.isPending}
                          className="bg-red-700 hover:bg-red-600 text-white text-xs font-bold h-7 px-2"
                        >
                          {endStream.isPending ? "Ending…" : "End Stream"}
                        </Button>
                      </>
                    )}
                    {stream.status === "scheduled" && (
                      <button
                        onClick={() => setExpandedId(expandedId === stream.id ? null : stream.id)}
                        className="text-[#FCD000] text-xs font-bold flex items-center gap-1"
                      >
                        How to Go Live
                        {expandedId === stream.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                    {stream.status === "ended" && stream.muxStreamId && (
                      <Button
                        size="sm"
                        onClick={() => saveRecording.mutate(stream.id)}
                        disabled={saveRecording.isPending}
                        className="bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold h-7 px-2"
                        title="Save recording to Videos"
                      >
                        <Film className="w-3 h-3 mr-1" />
                        {saveRecording.isPending ? "Saving…" : "Save Recording"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteStream.mutate(stream.id)}
                      disabled={deleteStream.isPending || stream.status === "live"}
                      className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white p-1 h-7 w-7"
                      data-testid={`button-delete-stream-${stream.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {stream.description && (
                  <p className="text-gray-400 text-sm mb-2">{stream.description}</p>
                )}

                {expandedId === stream.id && stream.muxStreamKey && (
                  <SetupGuide
                    stream={stream}
                    onGoLive={() => startStream.mutate(stream.id)}
                    onEndStream={() => endStream.mutate(stream.id)}
                    goLivePending={startStream.isPending}
                    endPending={endStream.isPending}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
