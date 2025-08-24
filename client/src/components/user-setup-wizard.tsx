import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Users, User, CheckCircle, Clock, Bell } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SetupData {
  firstName: string;
  lastName: string;
  allowDirectMessages: boolean;
  allowGroupInvites: boolean;
  prayerPermissionsGranted: boolean;
}

export function UserSetupWizard({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    allowDirectMessages: true,
    allowGroupInvites: true,
    prayerPermissionsGranted: false,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: SetupData) =>
      apiRequest('POST', '/api/profile/setup', {
        ...data,
        isProfileComplete: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Welcome to Man Up God's Way!",
        description: "Your profile has been set up successfully.",
      });
      onComplete();
    },
    onError: () => {
      toast({
        title: "Setup Failed",
        description: "There was an error setting up your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const requestPrayerPermissions = async () => {
    let permissionsGranted = true;
    
    // Request notification permission for prayer completion alerts
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        permissionsGranted = false;
      }
    }

    return permissionsGranted;
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!setupData.firstName.trim()) {
        toast({
          title: "First Name Required",
          description: "Please enter your first name to continue.",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      // Step 3 - request permissions if user enabled prayer features
      if (setupData.prayerPermissionsGranted) {
        const hasPermissions = await requestPrayerPermissions();
        if (!hasPermissions) {
          toast({
            title: "Permissions Needed",
            description: "Prayer notifications require permission to alert you when prayer time is complete.",
            variant: "destructive",
          });
          return;
        }
      }
      updateProfileMutation.mutate(setupData);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ministry-navy to-ministry-charcoal flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-ministry-charcoal dark:bg-ministry-charcoal border-ministry-steel dark:border-ministry-steel">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white dark:text-white">
            Welcome to Man Up God's Way
          </CardTitle>
          <p className="text-sm text-ministry-slate dark:text-ministry-slate">
            Let's set up your profile to get started
          </p>
          <div className="flex justify-center mt-4">
            <div className="flex space-x-2">
              <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-ministry-gold' : 'bg-ministry-steel'}`} />
              <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-ministry-gold' : 'bg-ministry-steel'}`} />
              <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-ministry-gold' : 'bg-ministry-steel'}`} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <>
              <div className="text-center">
                <User className="w-12 h-12 mx-auto mb-4 text-ministry-gold" />
                <h3 className="text-lg font-semibold text-white dark:text-white mb-2">
                  Personal Information
                </h3>
                <p className="text-sm text-ministry-slate dark:text-ministry-slate">
                  Tell us a bit about yourself
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="firstName" className="text-white dark:text-white">First Name *</Label>
                  <Input
                    id="firstName"
                    value={setupData.firstName}
                    onChange={(e) => setSetupData({ ...setupData, firstName: e.target.value })}
                    placeholder="Enter your first name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="lastName" className="text-white dark:text-white">Last Name</Label>
                  <Input
                    id="lastName"
                    value={setupData.lastName}
                    onChange={(e) => setSetupData({ ...setupData, lastName: e.target.value })}
                    placeholder="Enter your last name"
                    className="mt-1"
                  />
                </div>
              </div>

              <Button onClick={handleNext} className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal dark:text-ministry-charcoal">
                Continue
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-ministry-gold" />
                <h3 className="text-lg font-semibold text-white dark:text-white mb-2">
                  Communication Preferences
                </h3>
                <p className="text-sm text-ministry-slate dark:text-ministry-slate">
                  Choose how other members can connect with you
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border border-ministry-steel dark:border-ministry-steel rounded-lg">
                  <div className="flex items-start space-x-3">
                    <MessageSquare className="w-5 h-5 text-ministry-gold mt-0.5" />
                    <div>
                      <h4 className="font-medium text-white dark:text-white">Direct Messages</h4>
                      <p className="text-sm text-ministry-slate dark:text-ministry-slate">
                        Allow other members to send you private messages
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={setupData.allowDirectMessages}
                    onCheckedChange={(checked) => 
                      setSetupData({ ...setupData, allowDirectMessages: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border border-ministry-steel dark:border-ministry-steel rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Users className="w-5 h-5 text-ministry-gold mt-0.5" />
                    <div>
                      <h4 className="font-medium text-white dark:text-white">Group Invites</h4>
                      <p className="text-sm text-ministry-slate dark:text-ministry-slate">
                        Allow other members to invite you to group chats
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={setupData.allowGroupInvites}
                    onCheckedChange={(checked) => 
                      setSetupData({ ...setupData, allowGroupInvites: checked })
                    }
                  />
                </div>

                <div className="bg-ministry-navy/50 dark:bg-ministry-navy/50 p-4 rounded-lg border border-ministry-steel dark:border-ministry-steel">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-5 h-5 text-ministry-gold mt-0.5" />
                    <div>
                      <p className="text-sm text-white dark:text-white font-medium">Privacy Note</p>
                      <p className="text-xs text-ministry-slate dark:text-ministry-slate mt-1">
                        You can change these preferences anytime in your profile settings. 
                        These settings help maintain a respectful community environment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-1 bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal dark:text-ministry-charcoal"
                >
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 text-ministry-gold" />
                <h3 className="text-lg font-semibold text-white dark:text-white mb-2">
                  Prayer Time Features
                </h3>
                <p className="text-sm text-ministry-slate dark:text-ministry-slate">
                  Enable focus mode and notifications for your prayer time
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border border-ministry-steel dark:border-ministry-steel rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Bell className="w-5 h-5 text-ministry-gold mt-0.5" />
                    <div>
                      <h4 className="font-medium text-white dark:text-white">Prayer Notifications</h4>
                      <p className="text-sm text-ministry-slate dark:text-ministry-slate">
                        Get notified when your prayer time is complete and enable focus mode during prayer
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={setupData.prayerPermissionsGranted}
                    onCheckedChange={(checked) => 
                      setSetupData({ ...setupData, prayerPermissionsGranted: checked })
                    }
                  />
                </div>

                <div className="bg-ministry-navy/50 dark:bg-ministry-navy/50 p-4 rounded-lg border border-ministry-steel dark:border-ministry-steel">
                  <div className="flex items-start space-x-2">
                    <Clock className="w-5 h-5 text-ministry-gold mt-0.5" />
                    <div>
                      <p className="text-sm text-white dark:text-white font-medium">Prayer Time Benefits</p>
                      <p className="text-xs text-ministry-slate dark:text-ministry-slate mt-1">
                        When enabled, prayer time will enter fullscreen focus mode, keep your screen awake, 
                        and notify you when your dedicated prayer time is complete. This helps create a 
                        distraction-free environment for connecting with God.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={updateProfileMutation.isPending}
                  className="flex-1 bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal dark:text-ministry-charcoal"
                >
                  {updateProfileMutation.isPending ? 'Setting up...' : 'Complete Setup'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}