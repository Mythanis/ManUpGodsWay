import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Radio, Plus, Play, Square, Trash2, ExternalLink } from "lucide-react";
import { z } from "zod";

const createLiveStreamSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  streamUrl: z.string().url("Please enter a valid URL (e.g., YouTube Live, Facebook Live)"),
});

export default function LiveStreamManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
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
      streamUrl: "",
    },
  });

  const createStream = useMutation({
    mutationFn: async (data: z.infer<typeof createLiveStreamSchema>) => {
      return await apiRequest("POST", "/api/live-streams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-streams"] });
      toast({ title: "Success", description: "Live stream created successfully!" });
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
      toast({ title: "Success", description: "Live stream started! Users can now see it." });
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
      toast({ title: "Success", description: "Live stream ended." });
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
      toast({ title: "Success", description: "Live stream deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete stream", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return <Badge className="bg-red-600 text-white animate-pulse">🔴 LIVE</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-600 text-white">Scheduled</Badge>;
      case "ended":
        return <Badge className="bg-gray-600 text-white">Ended</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Streams</h2>
          <p className="text-gray-400 text-sm">Manage live streaming for your community</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-ministry-gold text-black hover:bg-ministry-gold/90" data-testid="button-create-stream">
              <Plus className="w-4 h-4 mr-2" />
              New Live Stream
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border border-gray-700">
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
                        <Input 
                          placeholder="e.g., Sunday Service Live"
                          className="bg-gray-800 border-gray-700 text-white"
                          {...field}
                          data-testid="input-stream-title"
                        />
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
                        <Textarea 
                          placeholder="Describe what this stream is about..."
                          className="bg-gray-800 border-gray-700 text-white"
                          {...field}
                          data-testid="input-stream-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="streamUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Stream URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://youtube.com/live/... or Facebook Live URL"
                          className="bg-gray-800 border-gray-700 text-white"
                          {...field}
                          data-testid="input-stream-url"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-gray-500">Enter your YouTube Live, Facebook Live, or other streaming URL</p>
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setDialogOpen(false)}
                    className="flex-1 border-gray-600 text-gray-300"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createStream.isPending}
                    className="flex-1 bg-ministry-gold text-black"
                    data-testid="button-submit-stream"
                  >
                    {createStream.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold mx-auto mb-4"></div>
          <p className="text-gray-400">Loading streams...</p>
        </div>
      ) : liveStreams.length === 0 ? (
        <Card className="bg-black border border-gray-700">
          <CardContent className="py-8 text-center">
            <Radio className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No live streams yet</p>
            <p className="text-gray-500 text-sm">Create your first live stream to engage with your community</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {liveStreams.map((stream: any) => (
            <Card key={stream.id} className="bg-black border border-gray-700" data-testid={`stream-card-${stream.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-white">{stream.title}</h3>
                      {getStatusBadge(stream.status)}
                    </div>
                    {stream.description && (
                      <p className="text-gray-400 text-sm mb-2">{stream.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <ExternalLink className="w-3 h-3" />
                      <a 
                        href={stream.streamUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-ministry-gold truncate max-w-xs"
                      >
                        {stream.streamUrl}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {stream.status === "scheduled" && (
                      <Button
                        size="sm"
                        onClick={() => startStream.mutate(stream.id)}
                        disabled={startStream.isPending}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        data-testid={`button-start-stream-${stream.id}`}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Go Live
                      </Button>
                    )}
                    {stream.status === "live" && (
                      <Button
                        size="sm"
                        onClick={() => endStream.mutate(stream.id)}
                        disabled={endStream.isPending}
                        className="bg-gray-600 hover:bg-gray-700 text-white"
                        data-testid={`button-end-stream-${stream.id}`}
                      >
                        <Square className="w-4 h-4 mr-1" />
                        End Stream
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteStream.mutate(stream.id)}
                      disabled={deleteStream.isPending || stream.status === "live"}
                      className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                      data-testid={`button-delete-stream-${stream.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-gray-900 border border-gray-700">
        <CardContent className="p-4">
          <h4 className="font-semibold text-white mb-2">How to go live:</h4>
          <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
            <li>Start your stream on YouTube Live, Facebook Live, or your preferred platform</li>
            <li>Copy the public watch URL for your stream</li>
            <li>Click "New Live Stream" and paste the URL</li>
            <li>Click "Go Live" when you're ready - a banner will appear for all community members</li>
            <li>Click "End Stream" when you're done broadcasting</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
