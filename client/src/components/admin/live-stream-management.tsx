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
import { Radio, Plus, Square, Trash2, Copy, Check, ChevronDown, ChevronUp, Tv } from "lucide-react";
import { z } from "zod";

const createLiveStreamSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  simulcastYoutubeKey: z.string().optional(),
  simulcastFacebookKey: z.string().optional(),
});

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs text-[#FCD000] hover:text-yellow-300 transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : label}
    </button>
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
    defaultValues: {
      title: "",
      description: "",
      simulcastYoutubeKey: "",
      simulcastFacebookKey: "",
    },
  });

  const createStream = useMutation({
    mutationFn: async (data: z.infer<typeof createLiveStreamSchema>) => {
      return await apiRequest("POST", "/api/live-streams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams"] });
      toast({ title: "Stream Created", description: "Your Mux stream is ready. Copy the RTMP details below and connect your broadcasting software." });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create stream", variant: "destructive" });
    },
  });

  const startStream = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/live-streams/${id}/start`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams/active"] });
      toast({ title: "Stream Marked Live", description: "Members can now see the live banner. Note: Mux auto-detects when your broadcast starts." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start stream", variant: "destructive" });
    },
  });

  const endStream = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/live-streams/${id}/end`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams/active"] });
      toast({ title: "Stream Ended", description: "The live stream has ended and the banner has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to end stream", variant: "destructive" });
    },
  });

  const deleteStream = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/live-streams/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams"] });
      toast({ title: "Deleted", description: "Live stream deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete stream", variant: "destructive" });
    },
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
          <p className="text-gray-400 text-sm">Go live inside the app — powered by Mux</p>
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
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Sunday Service Live" className="bg-gray-800 border-gray-700 text-white" {...field} data-testid="input-stream-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What is this stream about?" className="bg-gray-800 border-gray-700 text-white" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="border border-gray-700 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-bold text-[#FCD000] uppercase tracking-wide">Simulcast (Optional)</p>
                  <p className="text-xs text-gray-400">Stream to YouTube and/or Facebook at the same time as the app.</p>
                  <FormField
                    control={form.control}
                    name="simulcastYoutubeKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-xs">YouTube Stream Key</FormLabel>
                        <FormControl>
                          <Input placeholder="xxxx-xxxx-xxxx-xxxx" className="bg-gray-800 border-gray-700 text-white text-sm" {...field} />
                        </FormControl>
                        <p className="text-xs text-gray-500">YouTube Studio → Go Live → Stream key</p>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="simulcastFacebookKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-xs">Facebook Stream Key</FormLabel>
                        <FormControl>
                          <Input placeholder="FB-xxxx..." className="bg-gray-800 border-gray-700 text-white text-sm" {...field} />
                        </FormControl>
                        <p className="text-xs text-gray-500">Facebook Live Producer → Stream setup → Stream key</p>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 border-gray-600 text-gray-300">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createStream.isPending} className="flex-1 bg-[#FCD000] text-black font-bold" data-testid="button-submit-stream">
                    {createStream.isPending ? "Creating..." : "Create Stream"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading streams...</p>
        </div>
      ) : liveStreams.length === 0 ? (
        <Card className="bg-black border border-gray-700">
          <CardContent className="py-8 text-center">
            <Radio className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No live streams yet</p>
            <p className="text-gray-500 text-sm">Create your first stream to go live inside the app</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {liveStreams.map((stream: any) => (
            <Card key={stream.id} className="bg-black border border-gray-700" data-testid={`stream-card-${stream.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-white">{stream.title}</h3>
                    {getStatusBadge(stream.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    {stream.status === "scheduled" && (
                      <Button size="sm" onClick={() => startStream.mutate(stream.id)} disabled={startStream.isPending} className="bg-red-600 hover:bg-red-700 text-white text-xs" data-testid={`button-start-stream-${stream.id}`}>
                        🔴 Go Live
                      </Button>
                    )}
                    {stream.status === "live" && (
                      <Button size="sm" onClick={() => endStream.mutate(stream.id)} disabled={endStream.isPending} className="bg-gray-600 hover:bg-gray-700 text-white text-xs" data-testid={`button-end-stream-${stream.id}`}>
                        <Square className="w-3 h-3 mr-1" />
                        End
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => deleteStream.mutate(stream.id)} disabled={deleteStream.isPending || stream.status === "live"} className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white" data-testid={`button-delete-stream-${stream.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {stream.description && (
                  <p className="text-gray-400 text-sm mb-3">{stream.description}</p>
                )}

                {/* Mux stream details */}
                {stream.muxStreamKey && (
                  <div>
                    <button
                      onClick={() => setExpandedId(expandedId === stream.id ? null : stream.id)}
                      className="flex items-center gap-2 text-xs text-[#FCD000] font-bold uppercase tracking-wide mb-2"
                    >
                      <Tv className="w-3 h-3" />
                      Broadcasting Details
                      {expandedId === stream.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {expandedId === stream.id && (
                      <div className="bg-gray-900 rounded-lg p-3 space-y-3 text-xs">
                        <p className="text-gray-400">Connect OBS or any RTMP software using these settings:</p>

                        <div>
                          <p className="text-gray-500 uppercase tracking-wide mb-1">RTMP Server URL</p>
                          <div className="flex items-center justify-between bg-black rounded p-2">
                            <code className="text-green-400 text-xs truncate flex-1 mr-2">rtmps://global-live.mux.com:443/app</code>
                            <CopyButton value="rtmps://global-live.mux.com:443/app" label="Copy" />
                          </div>
                        </div>

                        <div>
                          <p className="text-gray-500 uppercase tracking-wide mb-1">Stream Key</p>
                          <div className="flex items-center justify-between bg-black rounded p-2">
                            <code className="text-green-400 text-xs truncate flex-1 mr-2">{stream.muxStreamKey}</code>
                            <CopyButton value={stream.muxStreamKey} label="Copy" />
                          </div>
                        </div>

                        {stream.muxPlaybackId && (
                          <div>
                            <p className="text-gray-500 uppercase tracking-wide mb-1">Playback URL (HLS)</p>
                            <div className="flex items-center justify-between bg-black rounded p-2">
                              <code className="text-green-400 text-xs truncate flex-1 mr-2">https://stream.mux.com/{stream.muxPlaybackId}.m3u8</code>
                              <CopyButton value={`https://stream.mux.com/${stream.muxPlaybackId}.m3u8`} label="Copy" />
                            </div>
                          </div>
                        )}

                        <div className="border-t border-gray-700 pt-2">
                          <p className="text-gray-500 text-xs">
                            <span className="text-[#FCD000] font-bold">OBS Settings:</span> Settings → Stream → Service: Custom → Server: rtmps://global-live.mux.com:443/app → Stream Key: (paste above)
                          </p>
                        </div>

                        {(stream.simulcastYoutubeKey || stream.simulcastFacebookKey) && (
                          <div className="border-t border-gray-700 pt-2">
                            <p className="text-[#FCD000] font-bold uppercase tracking-wide mb-1">Simulcasting To:</p>
                            {stream.simulcastYoutubeKey && <p className="text-gray-400">✓ YouTube</p>}
                            {stream.simulcastFacebookKey && <p className="text-gray-400">✓ Facebook</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-gray-900 border border-gray-700">
        <CardContent className="p-4">
          <h4 className="font-semibold text-white mb-2">How to go live in the app:</h4>
          <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
            <li>Click "New Stream" and give it a title</li>
            <li>Optionally add YouTube/Facebook stream keys to simulcast</li>
            <li>Open your broadcasting software (OBS, StreamYard, etc.)</li>
            <li>Paste the RTMP Server URL and Stream Key from the stream details</li>
            <li>Click "Go Live" in the admin panel — members will see a live banner</li>
            <li>Start broadcasting from your software — members watch inside the app</li>
            <li>Click "End" when done — the recording is automatically saved</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
