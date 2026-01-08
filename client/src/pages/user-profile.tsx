import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { 
  MessageCircle, 
  VolumeX, 
  Flag, 
  Calendar,
  BookOpen,
  Activity,
  MessageSquare,
  Crown,
  Shield,
  Star,
  EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TestimonyForm } from "@/components/testimony-form";
import BrotherhoodRequestButton from "@/components/brotherhood-request-button";
import { BackButton } from "@/components/BackButton";

interface UserProfile {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    subscriptionTier: string | null;
    role: string | null;
    createdAt: string;
    isProfilePrivate?: boolean;
  };
  studiesCompleted: number;
  daysActive: number;
  forumPosts: number;
  memberSince: Date;
}

const reportSchema = z.object({
  reason: z.string().min(10, "Please provide a detailed explanation (at least 10 characters)"),
  location: z.string().min(1, "Please specify where the issue occurred"),
});

type ReportFormValues = z.infer<typeof reportSchema>;

export default function UserProfile() {
  const { userId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showReportDialog, setShowReportDialog] = useState(false);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/users', userId, 'profile'],
    enabled: !!userId,
  });

  // Check if user is silenced
  const { data: silenceStatus } = useQuery<{ isSilenced: boolean }>({
    queryKey: ['/api/users', userId, 'silence', 'status'],
    enabled: !!userId,
  });

  const reportForm = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reason: "",
      location: "",
    },
  });

  const createReport = useMutation({
    mutationFn: async (data: ReportFormValues) => {
      return apiRequest('POST', '/api/users/report', {
        reportedUserId: userId,
        reason: data.reason,
        location: data.location,
      });
    },
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "Thank you for your report. Our admins will review it shortly.",
      });
      setShowReportDialog(false);
      reportForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    },
  });

  const silenceUser = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/users/${userId}/silence`);
    },
    onSuccess: () => {
      toast({
        title: "User Silenced",
        description: "You will no longer see posts or messages from this user.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users', userId, 'silence', 'status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to silence user",
        variant: "destructive",
      });
    },
  });

  const unsilenceUser = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/users/${userId}/silence`);
    },
    onSuccess: () => {
      toast({
        title: "User Unsilenced",
        description: "You will now see posts and messages from this user again.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users', userId, 'silence', 'status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unsilence user",
        variant: "destructive",
      });
    },
  });

  const createDirectConversation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/conversations/direct", { targetUserId: userId });
    },
    onSuccess: (conversation) => {
      // Navigate to messages page with the conversation selected
      setLocation(`/messages?conversation=${conversation.id}`);
      toast({
        title: "Success",
        description: "Opening direct message conversation.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start conversation",
        variant: "destructive",
      });
    },
  });

  const handleDirectMessage = () => {
    createDirectConversation.mutate();
  };

  const handleSilenceUser = () => {
    if (silenceStatus?.isSilenced) {
      unsilenceUser.mutate();
    } else {
      silenceUser.mutate();
    }
  };

  const formatMemberSince = (date: Date | string) => {
    const memberDate = new Date(date);
    return memberDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getTierInfo = (tier: string | null, role: string | null) => {
    if (role === 'admin') {
      return {
        label: 'Admin',
        icon: <Shield className="w-4 h-4" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
      };
    }

    switch (tier) {
      case 'vip':
        return {
          label: 'VIP Member',
          icon: <Crown className="w-4 h-4" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
        };
      case 'premium':
        return {
          label: 'Premium Member',
          icon: <Star className="w-4 h-4" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
        };
      default:
        return {
          label: 'Free Member',
          icon: null,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
        };
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold text-gray-600">User not found</h2>
            <p className="text-gray-500 mt-2">The user profile you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierInfo = getTierInfo(profile.user.subscriptionTier, profile.user.role);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pb-20">
      <BackButton fallbackPath="/brothers" />
      <h1 className="text-2xl font-bold text-ministry-charcoal mb-6">User Profile</h1>

      {/* User Info Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-4">
            <img
              src={profile.user.profileImageUrl || `https://ui-avatars.com/api/?name=${profile.user.firstName}+${profile.user.lastName}&background=4A90B8&color=fff&size=80`}
              alt={`${profile.user.firstName} ${profile.user.lastName}`}
              className="w-20 h-20 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-xl font-semibold text-ministry-charcoal">
                  {profile.user.firstName} {profile.user.lastName}
                </h2>
                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${tierInfo.bgColor} ${tierInfo.color}`}>
                  {tierInfo.icon}
                  <span>{tierInfo.label}</span>
                </div>
              </div>
              <div className="flex items-center text-sm text-ministry-slate mb-4">
                <Calendar className="w-4 h-4 mr-1" />
                Member since {formatMemberSince(profile.memberSince)}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleDirectMessage}
                  size="sm"
                  className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
                  disabled={createDirectConversation.isPending}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {createDirectConversation.isPending ? 'Opening...' : 'Direct Message'}
                </Button>
                <BrotherhoodRequestButton
                  recipientId={profile.user.id}
                  recipientName={`${profile.user.firstName} ${profile.user.lastName}`}
                />
                <Button
                  onClick={handleSilenceUser}
                  variant="outline"
                  size="sm"
                  className={silenceStatus?.isSilenced 
                    ? "border-green-300 text-green-600 hover:bg-green-50" 
                    : "bg-ministry-charcoal border-ministry-charcoal text-white hover:bg-ministry-charcoal/90"
                  }
                  disabled={silenceUser.isPending || unsilenceUser.isPending}
                >
                  <VolumeX className="w-4 h-4 mr-2" />
                  {silenceStatus?.isSilenced ? 'Unsilence' : 'Silence'}
                </Button>
                <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Report User</DialogTitle>
                    </DialogHeader>
                    <Form {...reportForm}>
                      <form onSubmit={reportForm.handleSubmit((data) => createReport.mutate(data))} className="space-y-4">
                        <FormField
                          control={reportForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Where did this issue occur?</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="discussion">Discussion Forum</SelectItem>
                                  <SelectItem value="direct_message">Direct Message</SelectItem>
                                  <SelectItem value="group_chat">Group Chat</SelectItem>
                                  <SelectItem value="study_comments">Study Comments</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={reportForm.control}
                          name="reason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Please explain the issue</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe what happened and why you're reporting this user..."
                                  className="min-h-[100px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowReportDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createReport.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            {createReport.isPending ? "Submitting..." : "Submit Report"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Content - Show statistics only if profile is not private */}
      {profile.user.isProfilePrivate ? (
        <Card className="mb-6">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-ministry-steel/20 rounded-full flex items-center justify-center">
              <EyeOff className="w-8 h-8 text-ministry-steel" />
            </div>
            <h3 className="text-lg font-semibold text-ministry-charcoal mb-2">Private Profile</h3>
            <p className="text-ministry-slate">
              This user has chosen to keep their profile information private.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-ministry-slate truncate">Studies Completed</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="text-2xl font-bold text-ministry-charcoal">{profile.studiesCompleted}</div>
              <p className="text-xs text-ministry-slate overflow-wrap-anywhere">Biblical studies finished</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-ministry-slate truncate">Days Active</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="text-2xl font-bold text-ministry-charcoal">{profile.daysActive}</div>
              <p className="text-xs text-ministry-slate overflow-wrap-anywhere">Days with activity</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-ministry-slate truncate">Forum Posts</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="text-2xl font-bold text-ministry-charcoal">{profile.forumPosts}</div>
              <p className="text-xs text-ministry-slate overflow-wrap-anywhere">Discussions and replies</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-ministry-slate truncate">Member Tier</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className={`text-lg font-bold ${tierInfo.color} leading-tight overflow-wrap-anywhere`}>
                {tierInfo.label}
              </div>
              <p className="text-xs text-ministry-slate overflow-wrap-anywhere">Subscription level</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Testimony Section - Only show if profile is not private */}
      {!profile.user.isProfilePrivate && (
        <div className="mb-6">
          <TestimonyForm userId={userId} isOwnProfile={false} />
        </div>
      )}
    </div>
  );
}