import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Bell, 
  BookOpen, 
  Video, 
  Heart, 
  MessageCircle, 
  Users, 
  Mail,
  Shield,
  UserX,
  X
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

interface SilencedUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatar: string | null;
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
  const [silencedDialogOpen, setSilencedDialogOpen] = useState(false);
  const [silencedToRemove, setSilencedToRemove] = useState<Set<string>>(new Set());

  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/notification-preferences'],
  });

  // Fetch silenced users
  const { data: silencedData } = useQuery<{ silencedUserIds: string[] }>({
    queryKey: ["/api/users/silenced"],
    retry: false,
  });

  // Fetch user details for silenced users
  const { data: allUsers = [] } = useQuery<SilencedUser[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  const silencedUsers = silencedData?.silencedUserIds 
    ? allUsers.filter(user => silencedData.silencedUserIds.includes(user.id))
    : [];

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

  // Unsilence users mutation
  const unsilenceUsersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      await Promise.all(
        userIds.map(userId => apiRequest("DELETE", `/api/users/${userId}/silence`))
      );
    },
    onSuccess: () => {
      toast({
        title: "Users Unsilenced",
        description: "Selected users have been unsilenced successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/silenced"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSilencedToRemove(new Set());
      setSilencedDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unsilence users. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggleSilencedUser = (userId: string) => {
    const newSet = new Set(silencedToRemove);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSilencedToRemove(newSet);
  };

  const handleSaveSilencedChanges = () => {
    if (silencedToRemove.size > 0) {
      unsilenceUsersMutation.mutate(Array.from(silencedToRemove));
    } else {
      setSilencedDialogOpen(false);
    }
  };

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

          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserX className="w-5 h-5 text-ministry-gold" />
                <span>User Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-row items-center justify-between rounded-lg border border-ministry-steel p-4">
                <div className="space-y-0.5">
                  <div className="text-base font-medium text-ministry-charcoal">
                    Silenced Users
                  </div>
                  <div className="text-sm text-ministry-slate">
                    Manage users you have silenced ({silencedUsers.length} users)
                  </div>
                </div>
                <Dialog open={silencedDialogOpen} onOpenChange={setSilencedDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="border-ministry-steel text-ministry-charcoal hover:bg-ministry-steel/10"
                      onClick={() => {
                        setSilencedToRemove(new Set());
                        setSilencedDialogOpen(true);
                      }}
                    >
                      Manage
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Silenced Users</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-96 overflow-y-auto">
                      {silencedUsers.length === 0 ? (
                        <p className="text-center text-ministry-slate py-8">
                          No silenced users
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {silencedUsers.map((user) => (
                            <div 
                              key={user.id}
                              className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                silencedToRemove.has(user.id) 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-ministry-steel hover:bg-ministry-steel/5'
                              }`}
                              onClick={() => handleToggleSilencedUser(user.id)}
                            >
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={user.avatar || ''} alt={user.firstName || ''} />
                                <AvatarFallback className="bg-ministry-gold/20 text-ministry-gold">
                                  {user.firstName?.[0] || user.email[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-ministry-charcoal truncate">
                                  {user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email}
                                </p>
                                <p className="text-xs text-ministry-slate truncate">
                                  {user.email}
                                </p>
                              </div>
                              {silencedToRemove.has(user.id) && (
                                <X className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {silencedUsers.length > 0 && (
                      <div className="flex justify-between pt-4">
                        <p className="text-xs text-ministry-slate self-center">
                          {silencedToRemove.size > 0 ? `${silencedToRemove.size} selected to unsilence` : 'Click users to unsilence them'}
                        </p>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => setSilencedDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveSilencedChanges}
                            disabled={unsilenceUsersMutation.isPending}
                            className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
                          >
                            {unsilenceUsersMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
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