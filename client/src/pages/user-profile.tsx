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
        color: 'text-red-400',
        bgColor: 'bg-red-500/20 border border-red-500/30',
      };
    }

    const status = (profile?.user as any)?.subscriptionStatus;
    if (status === 'active') {
      return {
        label: 'Subscriber',
        icon: <Crown className="w-4 h-4" />,
        color: 'text-[#FDD000]',
        bgColor: 'bg-[#FDD000]/20 border border-[#FDD000]/30',
      };
    }
    if (status === 'trial') {
      return {
        label: 'Trial',
        icon: <Star className="w-4 h-4" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20 border border-blue-500/30',
      };
    }
    if (status === 'expired' || status === 'cancelled') {
      return {
        label: 'Expired',
        icon: null,
        color: 'text-white/40',
        bgColor: 'bg-white/5 border border-white/10',
      };
    }
    return {
      label: 'Member',
      icon: null,
      color: 'text-white/60',
      bgColor: 'bg-white/10 border border-white/20',
    };
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-zinc-800 rounded"></div>
            <div className="h-24 bg-zinc-800 rounded"></div>
            <div className="h-24 bg-zinc-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-zinc-900 border border-white/10">
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold text-white/60">User not found</h2>
            <p className="text-white/40 mt-2">The user profile you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierInfo = getTierInfo(profile.user.subscriptionTier, profile.user.role);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pb-20">
      <BackButton fallbackPath="/brothers" />
      <h1 className="text-2xl font-black uppercase tracking-wider text-[#FDD000] mb-6" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>User Profile</h1>

      <Card className="mb-6 bg-black border border-[#FDD000]/20">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-4">
            <img
              src={profile.user.profileImageUrl || `https://ui-avatars.com/api/?name=${profile.user.firstName}+${profile.user.lastName}&background=FCD000&color=000&size=80&bold=true`}
              alt={`${profile.user.firstName} ${profile.user.lastName}`}
              className="w-20 h-20 rounded-full object-cover border-2 border-[#FDD000]/40"
            />
            <div className="flex-1">
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <h2 className="text-xl font-bold text-white uppercase tracking-wide" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {profile.user.firstName} {profile.user.lastName}
                </h2>
                <div className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${tierInfo.bgColor} ${tierInfo.color}`}>
                  {tierInfo.icon}
                  <span>{tierInfo.label}</span>
                </div>
              </div>
              <div className="flex items-center text-sm text-white/50 mb-4">
                <Calendar className="w-4 h-4 mr-1 text-[#FDD000]/60" />
                Member since {formatMemberSince(profile.memberSince)}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleDirectMessage}
                  size="sm"
                  className="bg-[#FDD000] hover:bg-[#FDD000]/80 text-black font-bold uppercase tracking-wide text-xs"
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
                    ? "border-green-500/40 text-green-400 hover:bg-green-500/10 font-bold uppercase tracking-wide text-xs" 
                    : "border-white/20 text-white/70 hover:bg-white/10 font-bold uppercase tracking-wide text-xs"
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
                      className="border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold uppercase tracking-wide text-xs"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-black border border-[#FDD000]/20 text-white">
                    <DialogHeader>
                      <DialogTitle className="text-[#FDD000] font-black uppercase tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Report User</DialogTitle>
                    </DialogHeader>
                    <Form {...reportForm}>
                      <form onSubmit={reportForm.handleSubmit((data) => createReport.mutate(data))} className="space-y-4">
                        <FormField
                          control={reportForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white/80 font-semibold text-sm">Where did this issue occur?</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-black border-white/20 text-white">
                                    <SelectValue placeholder="Select location" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-zinc-900 border-white/20 text-white">
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
                              <FormLabel className="text-white/80 font-semibold text-sm">Please explain the issue</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe what happened and why you're reporting this user..."
                                  className="min-h-[100px] bg-black border-white/20 text-white placeholder:text-white/30"
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
                            className="border-white/20 text-white/70 hover:bg-white/10"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createReport.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wide text-xs"
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

      {profile.user.isProfilePrivate ? (
        <Card className="mb-6 bg-black border border-white/10">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
              <EyeOff className="w-8 h-8 text-white/40" />
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wide" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Private Profile</h3>
            <p className="text-white/50 mt-2">
              This user has chosen to keep their profile information private.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="overflow-hidden bg-black border border-[#FDD000]/20">
            <CardContent className="p-4 text-center">
              <BookOpen className="w-5 h-5 text-[#FDD000] mx-auto mb-2" />
              <div className="text-2xl font-black text-[#FDD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{profile.studiesCompleted}</div>
              <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mt-1">Studies Done</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-black border border-[#FDD000]/20">
            <CardContent className="p-4 text-center">
              <Activity className="w-5 h-5 text-[#FDD000] mx-auto mb-2" />
              <div className="text-2xl font-black text-[#FDD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{profile.daysActive}</div>
              <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mt-1">Days Active</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-black border border-[#FDD000]/20">
            <CardContent className="p-4 text-center">
              <MessageSquare className="w-5 h-5 text-[#FDD000] mx-auto mb-2" />
              <div className="text-2xl font-black text-[#FDD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{profile.forumPosts}</div>
              <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mt-1">Forum Posts</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-black border border-[#FDD000]/20">
            <CardContent className="p-4 text-center">
              {tierInfo.icon ? <div className={`${tierInfo.color} mx-auto mb-2 flex justify-center`}>{tierInfo.icon}</div> : <Star className="w-5 h-5 text-white/40 mx-auto mb-2" />}
              <div className={`text-lg font-black leading-tight uppercase tracking-wide ${tierInfo.color}`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                {tierInfo.label}
              </div>
              <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mt-1">Member Tier</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!profile.user.isProfilePrivate && (
        <div className="mb-6">
          <TestimonyForm userId={userId} isOwnProfile={false} />
        </div>
      )}
    </div>
  );
}