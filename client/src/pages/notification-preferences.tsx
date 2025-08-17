import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Bell, 
  BookOpen, 
  Video, 
  Heart, 
  MessageCircle, 
  Users, 
  Mail,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export default function NotificationPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    },
  });

  // Update form when preferences data loads
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
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-24 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ministry-charcoal mb-2">Notification Preferences</h1>
        <p className="text-ministry-slate">
          Choose which notifications you'd like to receive. Admin notifications cannot be disabled.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Content Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-ministry-gold" />
                <span>Content Updates</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="newStudies"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-ministry-steel p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-ministry-charcoal">
                        New Bible Studies
                      </FormLabel>
                      <FormDescription>
                        Get notified when new Bible studies are published
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newVideos"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-ministry-steel p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-ministry-charcoal">
                        New Videos
                      </FormLabel>
                      <FormDescription>
                        Get notified when new videos are published
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newDevotionals"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-ministry-steel p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-ministry-charcoal">
                        Daily Devotionals
                      </FormLabel>
                      <FormDescription>
                        Get notified when new daily devotionals are available
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Community Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="w-5 h-5 text-ministry-gold" />
                <span>Community Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="discussionReplies"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-ministry-steel p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-ministry-charcoal">
                        Discussion Replies
                      </FormLabel>
                      <FormDescription>
                        Get notified when someone replies to your discussions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="directMessages"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-ministry-steel p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-ministry-charcoal">
                        Direct Messages
                      </FormLabel>
                      <FormDescription>
                        Get notified when you receive direct messages
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="groupMessages"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-ministry-steel p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-ministry-charcoal">
                        Group Messages
                      </FormLabel>
                      <FormDescription>
                        Get notified about activity in your group conversations
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Digest Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-ministry-gold" />
                <span>Weekly Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="weeklyDigest"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-ministry-steel p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-ministry-charcoal">
                        Weekly Digest
                      </FormLabel>
                      <FormDescription>
                        Get a weekly summary of new content and community activity
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Admin Notice */}
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Important Notice
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Admin notifications (announcements, reports, and system alerts) cannot be disabled 
                    to ensure you receive important ministry updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4 pb-8">
            <Button
              type="submit"
              disabled={updatePreferences.isPending}
              className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
            >
              {updatePreferences.isPending ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}