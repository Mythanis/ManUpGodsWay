import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { 
  Bell, 
  BookOpen, 
  Video, 
  Heart, 
  MessageCircle, 
  Users, 
  Mail,
  Shield,
  Radio,
  Smartphone,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BackButton } from "@/components/BackButton";
import { usePushNotifications } from "@/hooks/use-push-notifications";

interface NotificationPreferences {
  id: string;
  userId: string;
  newStudies: boolean;
  newVideos: boolean;
  newDevotionals: boolean;
  discussionReplies: boolean;
  directMessages: boolean;
  groupMessages: boolean;
  weeklyDigest: boolean;
  liveStreamNotifications: boolean;
  createdAt: string;
  updatedAt: string;
}

const preferencesSchema = z.object({
  newStudies: z.boolean(),
  newVideos: z.boolean(),
  newDevotionals: z.boolean(),
  discussionReplies: z.boolean(),
  directMessages: z.boolean(),
  groupMessages: z.boolean(),
  weeklyDigest: z.boolean(),
  liveStreamNotifications: z.boolean(),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export default function NotificationPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { 
    isSupported: pushSupported, 
    permission: pushPermission,
    isSubscribed: isPushEnabled, 
    isPending: isPushPending,
    subscribe: enablePush, 
    unsubscribe: disablePush 
  } = usePushNotifications();

  const handlePushToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        const success = await enablePush();
        if (success) {
          toast({
            title: "Push Notifications Enabled",
            description: "You'll now receive notifications on this device.",
          });
        } else if (pushPermission === 'denied') {
          toast({
            title: "Permission Denied",
            description: "Please enable notifications in your browser settings.",
            variant: "destructive",
          });
        }
      } else {
        await disablePush();
        toast({
          title: "Push Notifications Disabled",
          description: "You won't receive push notifications on this device.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update push notification settings.",
        variant: "destructive",
      });
    }
  };

  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/notification-preferences'],
  });

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      newStudies: true,
      newVideos: true,
      newDevotionals: true,
      discussionReplies: true,
      directMessages: true,
      groupMessages: true,
      weeklyDigest: true,
      liveStreamNotifications: true,
    },
  });

  useEffect(() => {
    if (preferences) {
      form.reset({
        newStudies: preferences.newStudies,
        newVideos: preferences.newVideos,
        newDevotionals: preferences.newDevotionals,
        discussionReplies: preferences.discussionReplies,
        directMessages: preferences.directMessages,
        groupMessages: preferences.groupMessages,
        weeklyDigest: preferences.weeklyDigest,
        liveStreamNotifications: preferences.liveStreamNotifications,
      });
    }
  }, [preferences]);

  const updatePreferences = useMutation({
    mutationFn: async (data: PreferencesFormValues) => {
      return apiRequest('PATCH', '/api/notification-preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences'] });
      toast({
        title: "Settings Updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update preferences",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PreferencesFormValues) => {
    updatePreferences.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black pb-24">
        <div className="liquid-black border-b-4 border-ministry-gold-exact px-6 pt-12 pb-6 overflow-hidden">
          <div className="relative z-10">
            <BackButton fallbackPath="/profile" />
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase mt-4" style={{ fontFamily: "'Inter', sans-serif" }}>
              Notification Preferences
            </h1>
          </div>
        </div>
        <div className="px-6 py-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-none"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="liquid-black border-b-4 border-ministry-gold-exact px-6 pt-12 pb-6 overflow-hidden">
        <div className="relative z-10">
          <BackButton fallbackPath="/profile" />
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase mt-4" style={{ fontFamily: "'Inter', sans-serif" }}>
            Notification Preferences
          </h1>
          <p className="text-ministry-gold-exact text-sm font-bold uppercase tracking-widest mt-2">
            Choose What You Want To Hear About
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-6 space-y-6">
          
          {/* Push Notifications Section */}
          {pushSupported && (
            <div>
              <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>
                Device Notifications
              </h2>
              <div className="space-y-2">
                <div className="h-16 w-full flex items-center liquid-gold-card border-2 border-black overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-6 h-6 text-white relative z-10" />
                  </div>
                  <div className="flex-1 px-4 relative z-10">
                    <span className="font-black text-sm text-black uppercase tracking-wide">Push Notifications</span>
                    <p className="text-xs text-black/70 mt-0.5">Get alerts on your phone's home screen</p>
                  </div>
                  <div className="pr-4 relative z-10">
                    {isPushPending ? (
                      <Loader2 className="w-5 h-5 animate-spin text-black" />
                    ) : (
                      <Switch 
                        checked={isPushEnabled} 
                        onCheckedChange={handlePushToggle}
                        disabled={pushPermission === 'denied'}
                      />
                    )}
                  </div>
                </div>
                {pushPermission === 'denied' && (
                  <p className="text-xs text-red-400 px-1">
                    Push notifications are blocked. Please enable them in your browser/phone settings.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Content Updates Section */}
          <div>
            <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>
              Content Updates
            </h2>
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="newStudies"
                render={({ field }) => (
                  <FormItem>
                    <div className="h-16 w-full flex items-center liquid-gold-card border-2 border-black overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-6 h-6 text-white relative z-10" />
                      </div>
                      <div className="flex-1 px-4 relative z-10">
                        <span className="font-black text-sm text-black uppercase tracking-wide">New Bible Studies</span>
                      </div>
                      <FormControl>
                        <div className="pr-4 relative z-10">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newVideos"
                render={({ field }) => (
                  <FormItem>
                    <div className="h-16 w-full flex items-center liquid-gold-card border-2 border-black overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                        <Video className="w-6 h-6 text-white relative z-10" />
                      </div>
                      <div className="flex-1 px-4 relative z-10">
                        <span className="font-black text-sm text-black uppercase tracking-wide">New Videos</span>
                      </div>
                      <FormControl>
                        <div className="pr-4 relative z-10">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newDevotionals"
                render={({ field }) => (
                  <FormItem>
                    <div className="h-16 w-full flex items-center liquid-gold-card border-2 border-black overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                        <Heart className="w-6 h-6 text-white relative z-10" />
                      </div>
                      <div className="flex-1 px-4 relative z-10">
                        <span className="font-black text-sm text-black uppercase tracking-wide">Daily Devotionals</span>
                      </div>
                      <FormControl>
                        <div className="pr-4 relative z-10">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="liveStreamNotifications"
                render={({ field }) => (
                  <FormItem>
                    <div className="h-16 w-full flex items-center liquid-gold-card border-2 border-black overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                        <Radio className="w-6 h-6 text-white relative z-10" />
                      </div>
                      <div className="flex-1 px-4 relative z-10">
                        <span className="font-black text-sm text-black uppercase tracking-wide">Live Streams</span>
                      </div>
                      <FormControl>
                        <div className="pr-4 relative z-10">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Community Activity Section */}
          <div>
            <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>
              Community Activity
            </h2>
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="discussionReplies"
                render={({ field }) => (
                  <FormItem>
                    <div className="h-16 w-full flex items-center liquid-gold-card border-2 border-black overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-6 h-6 text-white relative z-10" />
                      </div>
                      <div className="flex-1 px-4 relative z-10">
                        <span className="font-black text-sm text-black uppercase tracking-wide">Discussion Replies</span>
                      </div>
                      <FormControl>
                        <div className="pr-4 relative z-10">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="directMessages"
                render={({ field }) => (
                  <FormItem>
                    <div className="h-16 w-full flex items-center liquid-gold-card border-2 border-black overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                        <Mail className="w-6 h-6 text-white relative z-10" />
                      </div>
                      <div className="flex-1 px-4 relative z-10">
                        <span className="font-black text-sm text-black uppercase tracking-wide">Direct Messages</span>
                      </div>
                      <FormControl>
                        <div className="pr-4 relative z-10">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="groupMessages"
                render={({ field }) => (
                  <FormItem>
                    <div className="h-16 w-full flex items-center liquid-gold-card border-2 border-black overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-white relative z-10" />
                      </div>
                      <div className="flex-1 px-4 relative z-10">
                        <span className="font-black text-sm text-black uppercase tracking-wide">Group Messages</span>
                      </div>
                      <FormControl>
                        <div className="pr-4 relative z-10">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Weekly Summary Section */}
          <div>
            <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>
              Weekly Summary
            </h2>
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="weeklyDigest"
                render={({ field }) => (
                  <FormItem>
                    <div className="h-16 w-full flex items-center liquid-gold-card border-2 border-black overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                        <Bell className="w-6 h-6 text-white relative z-10" />
                      </div>
                      <div className="flex-1 px-4 relative z-10">
                        <span className="font-black text-sm text-black uppercase tracking-wide">Weekly Digest</span>
                      </div>
                      <FormControl>
                        <div className="pr-4 relative z-10">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Admin Notice */}
          <Card className="liquid-gold-card border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-black mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-black text-black uppercase tracking-wide">
                    Important Notice
                  </p>
                  <p className="text-sm text-black/70 mt-1 font-medium">
                    Admin notifications (announcements, reports, and system alerts) cannot be disabled 
                    to ensure you receive important ministry updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button
            type="submit"
            disabled={updatePreferences.isPending}
            className="w-full h-14 liquid-black text-ministry-gold-exact hover:opacity-90 rounded-none font-black uppercase tracking-wide border-2 border-ministry-gold-exact shadow-[3px_3px_0px_0px_rgba(252,208,0,1)]"
            data-testid="button-save-preferences"
          >
            <span className="relative z-10">
              {updatePreferences.isPending ? "Saving..." : "Save Preferences"}
            </span>
          </Button>
        </form>
      </Form>
    </div>
  );
}
