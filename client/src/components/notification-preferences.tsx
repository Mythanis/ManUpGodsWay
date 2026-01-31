import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Bell, Settings, AlertCircle, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NotificationPreferences {
  id: string;
  userId: string;
  studyNotifications: boolean;
  nextStudyNotifications: boolean;
  devotionalNotifications: boolean;
  discussionNotifications: boolean;
  discussionReplyNotifications: boolean;
  messageNotifications: boolean;
  videoNotifications: boolean;
  communityNotifications: boolean;
  createdAt: string;
  updatedAt: string;
}

export function NotificationPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/notification-preferences'],
  });

  const [localPreferences, setLocalPreferences] = useState<Partial<NotificationPreferences>>({});

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const response = await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Update preferences error:', response.status, errorData);
        throw new Error(`Failed to update preferences: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences'] });
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved successfully.",
      });
      setLocalPreferences({});
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update notification preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    setLocalPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (Object.keys(localPreferences).length > 0) {
      updateMutation.mutate(localPreferences);
    }
  };

  const getEffectiveValue = (key: keyof NotificationPreferences): boolean => {
    if (key in localPreferences) {
      return localPreferences[key] as boolean;
    }
    return preferences?.[key] as boolean ?? true;
  };

  const hasChanges = Object.keys(localPreferences).length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(7).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-48 animate-pulse" />
                </div>
                <div className="h-6 w-11 bg-muted rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const notificationSettings = [
    {
      key: 'studyNotifications' as const,
      title: 'New Study Notifications',
      description: 'Get notified when new Bible studies are published',
      icon: <Bell className="h-4 w-4" />
    },
    {
      key: 'nextStudyNotifications' as const,
      title: 'Daily Study Reminders',
      description: 'Get notified each day when your next study in a series is ready',
      icon: <Bell className="h-4 w-4" />
    },
    {
      key: 'devotionalNotifications' as const,
      title: 'Daily Devotional Notifications',
      description: 'Receive notifications for new daily devotionals',
      icon: <Bell className="h-4 w-4" />
    },
    {
      key: 'videoNotifications' as const,
      title: 'Video Content Notifications',
      description: 'Get notified when new videos are uploaded',
      icon: <Bell className="h-4 w-4" />
    },
    {
      key: 'discussionNotifications' as const,
      title: 'New Discussion Notifications',
      description: 'Be notified when new community discussions are started',
      icon: <Bell className="h-4 w-4" />
    },
    {
      key: 'discussionReplyNotifications' as const,
      title: 'Discussion Reply Notifications',
      description: 'Get notified when someone replies to discussions you\'re subscribed to',
      icon: <Bell className="h-4 w-4" />
    },
    {
      key: 'messageNotifications' as const,
      title: 'Message Notifications',
      description: 'Receive notifications for direct messages and group chats',
      icon: <Bell className="h-4 w-4" />
    },
    {
      key: 'communityNotifications' as const,
      title: 'Community Activity Notifications',
      description: 'General community updates and announcements',
      icon: <Bell className="h-4 w-4" />
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Control which notifications you receive. Changes are saved automatically when you click Save Changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Admin Notification Notice */}
          <Alert className="bg-ministry-gold-exact border-ministry-gold">
            <Shield className="h-4 w-4 text-black" />
            <AlertDescription className="text-black">
              <strong>Important:</strong> Admin broadcasts and system notifications cannot be disabled and will always be delivered for security and platform updates.
            </AlertDescription>
          </Alert>

          <Separator />

          {/* Notification Settings */}
          <div className="space-y-6">
            {notificationSettings.map((setting) => (
              <div key={setting.key} className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    {setting.icon}
                    <Label 
                      htmlFor={setting.key}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {setting.title}
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {setting.description}
                  </p>
                </div>
                <Switch
                  id={setting.key}
                  checked={getEffectiveValue(setting.key)}
                  onCheckedChange={(checked) => handleToggle(setting.key, checked)}
                  className="ml-4"
                />
              </div>
            ))}
          </div>

          {hasChanges && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  You have unsaved changes
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalPreferences({})}
                    disabled={updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}