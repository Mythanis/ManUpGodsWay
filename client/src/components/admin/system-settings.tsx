import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SystemSettings {
  id: string;
  homepageTagline: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function SystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tagline, setTagline] = useState("");

  // Fetch system settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['api', 'system-settings'],
    queryFn: () => fetch('/api/system-settings').then(res => res.json()) as Promise<SystemSettings>
  });

  // Update system settings mutation
  const updateSystemSettings = useMutation({
    mutationFn: (data: { homepageTagline: string }) =>
      fetch('/api/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'system-settings'] });
      toast({
        title: "Success",
        description: "Homepage tagline updated successfully"
      });
    },
    onError: (error: any) => {
      console.error("Error updating system settings:", error);
      toast({
        title: "Error", 
        description: error.message || "Failed to update settings",
        variant: "destructive"
      });
    }
  });

  // Initialize tagline when settings load
  React.useEffect(() => {
    if (settings && settings.homepageTagline && tagline !== settings.homepageTagline) {
      setTagline(settings.homepageTagline);
    }
  }, [settings, settings?.homepageTagline]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagline.trim()) {
      toast({
        title: "Error",
        description: "Homepage tagline cannot be empty",
        variant: "destructive"
      });
      return;
    }
    updateSystemSettings.mutate({ homepageTagline: tagline });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-ministry-gold" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-ministry-charcoal mb-4">System Settings</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Homepage Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tagline">Homepage Tagline</Label>
              <Textarea
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Enter the tagline that will appear on all users' homepage"
                rows={3}
                className="resize-none"
              />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This message will appear on the homepage for all users.
              </p>
            </div>

            <Button 
              type="submit" 
              disabled={updateSystemSettings.isPending || tagline === settings?.homepageTagline}
              className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
            >
              {updateSystemSettings.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                "Update Tagline"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}