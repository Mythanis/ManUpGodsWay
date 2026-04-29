import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Home, Shield, Calendar, RefreshCw, AlertTriangle } from "lucide-react";

interface SystemSettings {
  id: string;
  homepageTagline: string;
  warGroupsCalendlyUrl: string | null;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function SystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tagline, setTagline] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [showForceReloadConfirm, setShowForceReloadConfirm] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['api', 'system-settings'],
    queryFn: () => fetch('/api/system-settings').then(res => res.json()) as Promise<SystemSettings>
  });

  const updateTaglineMutation = useMutation({
    mutationFn: (data: { homepageTagline: string }) =>
      fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'system-settings'] });
      toast({ title: "Success", description: "Homepage tagline updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update settings", variant: "destructive" });
    }
  });

  const forceReloadMutation = useMutation({
    mutationFn: () =>
      fetch('/api/admin/force-reload', { method: 'POST', credentials: 'include' }).then(res => res.json()) as Promise<{ ok: boolean; connectedCount: number }>,
    onSuccess: (data) => {
      setShowForceReloadConfirm(false);
      toast({
        title: "Refresh Signal Sent",
        description: `Reload sent to ${data.connectedCount} connected session${data.connectedCount !== 1 ? 's' : ''}.`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send refresh signal.", variant: "destructive" });
    },
  });

  const updateCalendlyMutation = useMutation({
    mutationFn: (data: { warGroupsCalendlyUrl: string }) =>
      fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'system-settings'] });
      toast({ title: "Success", description: "Calendly link updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update Calendly link", variant: "destructive" });
    }
  });

  React.useEffect(() => {
    if (settings) {
      if (settings.homepageTagline && tagline !== settings.homepageTagline) {
        setTagline(settings.homepageTagline);
      }
      if (settings.warGroupsCalendlyUrl !== undefined && calendlyUrl !== (settings.warGroupsCalendlyUrl || "")) {
        setCalendlyUrl(settings.warGroupsCalendlyUrl || "");
      }
    }
  }, [settings]);

  const handleTaglineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagline.trim()) {
      toast({ title: "Error", description: "Homepage tagline cannot be empty", variant: "destructive" });
      return;
    }
    updateTaglineMutation.mutate({ homepageTagline: tagline });
  };

  const handleCalendlySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = calendlyUrl.trim();
    if (url && !url.includes('calendly.com')) {
      toast({ title: "Error", description: "Please enter a valid Calendly URL (e.g. https://calendly.com/your-name/meeting)", variant: "destructive" });
      return;
    }
    updateCalendlyMutation.mutate({ warGroupsCalendlyUrl: url });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-ministry-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-ministry-charcoal mb-4">System Settings</h2>

      {/* Homepage Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-ministry-gold" />
            <CardTitle>Homepage Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTaglineSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tagline">Homepage Tagline</Label>
              <Textarea
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Enter the tagline that will appear on all users' homepage"
                rows={3}
                className="resize-none"
                data-testid="input-homepage-tagline"
              />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This message will appear on the homepage for all users.
              </p>
            </div>
            <Button
              type="submit"
              disabled={updateTaglineMutation.isPending || tagline === settings?.homepageTagline}
              className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
              data-testid="button-update-tagline"
            >
              {updateTaglineMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating...</>
              ) : "Update Tagline"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* War Groups Calendly Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-ministry-gold" />
            <div>
              <CardTitle>War Groups — Schedule a Call</CardTitle>
              <CardDescription>
                Add your Calendly link so men can book a call to learn about or join a War Group
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCalendlySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calendlyUrl">Calendly URL</Label>
              <Input
                id="calendlyUrl"
                value={calendlyUrl}
                onChange={(e) => setCalendlyUrl(e.target.value)}
                placeholder="https://calendly.com/your-name/war-groups-call"
                data-testid="input-calendly-url"
              />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Paste your Calendly scheduling link. Leave empty to hide the section on the War Groups page.
              </p>
            </div>

            {/* Live preview */}
            {calendlyUrl && calendlyUrl.includes('calendly.com') && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-lg overflow-hidden bg-black" style={{ height: 500 }}>
                  <iframe
                    src={`${calendlyUrl}?background_color=0a0a0a&text_color=ffffff&primary_color=FCD000&hide_gdpr_banner=1`}
                    className="w-full h-full border-0"
                    title="Calendly Preview"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={updateCalendlyMutation.isPending}
              className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
              data-testid="button-update-calendly"
            >
              {updateCalendlyMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating...</>
              ) : (
                <><Calendar className="h-4 w-4 mr-2" />Save Calendly Link</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Force App Refresh */}
      <Card className="border-orange-200 dark:border-orange-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-500" />
            <div>
              <CardTitle>Force App Refresh</CardTitle>
              <CardDescription>
                Send a reload signal to all currently connected users. Use after pushing updates or changing global settings.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!showForceReloadConfirm ? (
            <Button
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
              onClick={() => setShowForceReloadConfirm(true)}
              data-testid="button-force-reload-all"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh All Users Now
            </Button>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  This will reload the app for all currently connected users. Are you sure?
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => forceReloadMutation.mutate()}
                    disabled={forceReloadMutation.isPending}
                    data-testid="button-force-reload-confirm"
                  >
                    {forceReloadMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Sending...</>
                    ) : "Yes, Refresh All"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowForceReloadConfirm(false)}
                    disabled={forceReloadMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
