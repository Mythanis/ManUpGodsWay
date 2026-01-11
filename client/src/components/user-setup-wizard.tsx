import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Users, User, CheckCircle, Clock, Bell, FileText, Scale, Camera, Upload, X, Check } from "lucide-react";
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        permissionsGranted = false;
      }
    }

    return permissionsGranted;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setProfileImage(null);
    setProfileImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadProfileImage = async () => {
    if (!profileImage) return;
    
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('profileImage', profileImage);
      
      const response = await fetch('/api/profile/image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    } catch (error) {
      toast({
        title: "Image Upload Failed",
        description: "There was an error uploading your profile picture. You can add one later in settings.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
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
      if (profileImage) {
        await uploadProfileImage();
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else {
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

  const handleSkipProfilePicture = () => {
    setStep(3);
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      setStep(3);
    }
  };

  const handleAcceptTerms = () => {
    setAcceptedTerms(true);
    setShowTermsDialog(false);
  };

  const handleAcceptPrivacy = () => {
    setAcceptedPrivacy(true);
    setShowPrivacyDialog(false);
  };

  return (
    <>
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
                <div className={`w-3 h-3 rounded-full ${step >= 4 ? 'bg-ministry-gold' : 'bg-ministry-steel'}`} />
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
                  <Camera className="w-12 h-12 mx-auto mb-4 text-ministry-gold" />
                  <h3 className="text-lg font-semibold text-white dark:text-white mb-2">
                    Profile Picture
                  </h3>
                  <p className="text-sm text-ministry-slate dark:text-ministry-slate">
                    Add a photo so other members can recognize you
                  </p>
                </div>

                <div className="flex flex-col items-center space-y-4">
                  {profileImagePreview ? (
                    <div className="relative">
                      <img
                        src={profileImagePreview}
                        alt="Profile preview"
                        className="w-32 h-32 rounded-full object-cover border-4 border-ministry-gold"
                      />
                      <button
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-32 h-32 rounded-full border-4 border-dashed border-ministry-steel flex flex-col items-center justify-center cursor-pointer hover:border-ministry-gold transition-colors"
                    >
                      <Upload className="w-8 h-8 text-ministry-slate mb-2" />
                      <span className="text-xs text-ministry-slate">Upload Photo</span>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  {!profileImagePreview && (
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Photo
                    </Button>
                  )}
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
                    variant="outline"
                    onClick={handleSkipProfilePicture}
                    className="flex-1"
                  >
                    Skip
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!profileImage || isUploadingImage}
                    className="flex-1 bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal dark:text-ministry-charcoal disabled:opacity-50"
                  >
                    {isUploadingImage ? 'Uploading...' : 'Continue'}
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
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

            {step === 4 && (
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

                  <Separator className="bg-ministry-steel/50" />

                  <div className="space-y-4">
                    <p className="text-sm text-white dark:text-white font-medium text-center">
                      Click the Terms & Conditions and Privacy Policy links below and read to the end. At the bottom is an accept button you must click to fill in the check boxes below and enable the Complete Setup button.
                    </p>
                    
                    <div className="flex items-start space-x-3 p-3 border border-ministry-steel dark:border-ministry-steel rounded-lg">
                      <Checkbox
                        id="terms"
                        checked={acceptedTerms}
                        disabled={true}
                        className="mt-0.5 border-ministry-gold data-[state=checked]:bg-ministry-gold data-[state=checked]:text-ministry-charcoal"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-white dark:text-white">
                          I have read and agree to the{' '}
                          <button 
                            type="button"
                            onClick={() => setShowTermsDialog(true)} 
                            className="text-ministry-gold hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Scale className="w-3 h-3" />
                            Terms & Conditions
                          </button>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 border border-ministry-steel dark:border-ministry-steel rounded-lg">
                      <Checkbox
                        id="privacy"
                        checked={acceptedPrivacy}
                        disabled={true}
                        className="mt-0.5 border-ministry-gold data-[state=checked]:bg-ministry-gold data-[state=checked]:text-ministry-charcoal"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-white dark:text-white">
                          I have read and agree to the{' '}
                          <button 
                            type="button"
                            onClick={() => setShowPrivacyDialog(true)} 
                            className="text-ministry-gold hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            Privacy Policy
                          </button>
                        </span>
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
                    disabled={updateProfileMutation.isPending || !acceptedTerms || !acceptedPrivacy}
                    className="flex-1 bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal dark:text-ministry-charcoal disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? 'Setting up...' : 'Complete Setup'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] bg-ministry-charcoal border-ministry-gold">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Scale className="w-5 h-5 text-ministry-gold" />
              Terms of Use
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="text-white space-y-4">
              <p className="text-gray-400 text-sm">Effective Date: 1/9/2026</p>
              
              <p className="text-gray-300 text-sm leading-relaxed">
                By using this App, you agree to these Terms.
              </p>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">1. Purpose</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  This App exists to support the Man Up God's Way ministry.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">2. User Content</h2>
                <p className="text-gray-300 text-sm leading-relaxed mb-2">
                  You retain ownership of your submissions but grant us permission to store, display, and manage them within the App.
                </p>
                <p className="text-gray-300 text-sm leading-relaxed">
                  You agree not to submit unlawful, abusive, or inappropriate content.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">3. Account & Access</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We may suspend or remove content or access that violates these Terms.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">4. No Warranties</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  The App is provided "as-is" without warranties.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">5. Limitation of Liability</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We are not liable for damages arising from use of the App.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">6. Termination</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We may terminate access at any time.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">7. Governing Law</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Governed by laws of the United States.
                </p>
              </section>
            </div>
          </ScrollArea>
          <div className="pt-4 border-t border-ministry-steel">
            <Button
              onClick={handleAcceptTerms}
              className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-black font-bold uppercase py-3"
            >
              <Check className="w-5 h-5 mr-2" />
              I Accept the Terms & Conditions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] bg-ministry-charcoal border-ministry-gold">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-ministry-gold" />
              Privacy Policy
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="text-white space-y-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Effective Date: 1/9/2026</p>
                <p className="text-gray-400 text-sm mb-1">App Name: ManUp God's Way</p>
                <p className="text-gray-400 text-sm">Operated By: ManUp God's Way</p>
              </div>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">1. Introduction</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  ManUp God's Way ("we," "us," or "our") respects your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use our mobile application or related services ("the App").
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">2. Information We Collect</h2>
                <p className="text-gray-300 text-sm leading-relaxed mb-2">
                  We collect only information you voluntarily provide:
                </p>
                <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2">
                  <li>First name</li>
                  <li>Last name</li>
                  <li>Email address</li>
                  <li>Testimony content (text)</li>
                  <li>Uploaded pictures/images</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">3. How We Use Your Information</h2>
                <p className="text-gray-300 text-sm leading-relaxed mb-2">
                  We use your information solely to:
                </p>
                <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2">
                  <li>Operate and support the App</li>
                  <li>Display or manage submitted testimonies and content</li>
                  <li>Communicate with you</li>
                  <li>Send ministry-related emails</li>
                  <li>Maintain safety, integrity, and functionality of the App</li>
                </ul>
                <p className="text-gray-300 text-sm leading-relaxed mt-2">
                  We do not use your data for advertising, tracking, or profiling.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">4. Third-Party Services</h2>
                <p className="text-gray-300 text-sm leading-relaxed mb-3">
                  We do not sell or share your data. We use the following service providers:
                </p>
                
                <div className="mb-3">
                  <h3 className="font-bold text-white text-sm mb-1">Mailchimp</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Used only for sending ManUp God's Way emails.
                  </p>
                  <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mt-1">
                    <li>Only your email address is shared.</li>
                    <li>You may unsubscribe using the link in any email or by emailing jody@manupgodsway.org.</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-white text-sm mb-1">Replit</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Used for hosting and backend infrastructure.
                  </p>
                  <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mt-1">
                    <li>Your data may be stored on Replit-managed infrastructure.</li>
                    <li>Replit acts only as a technical service provider.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">5. Data Retention</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We retain your data only as long as needed for ministry and app operations unless legally required otherwise.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">6. Security</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We use commercially reasonable administrative, technical, and organizational safeguards. No system is 100% secure.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">7. Your Rights & Data Deletion</h2>
                <p className="text-gray-300 text-sm leading-relaxed mb-2">
                  You may request:
                </p>
                <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2">
                  <li>A copy of your data</li>
                  <li>Full deletion of your data</li>
                </ul>
                <p className="text-gray-300 text-sm leading-relaxed mt-2">
                  Email: jody@manupgodsway.org
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">8. Children's Privacy</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Not intended for children under 13.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">9. No Tracking</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We do not track users across apps or websites.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">10. Changes</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We may update this policy. Continued use means acceptance.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-ministry-gold uppercase mb-2">11. Contact</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  jody@manupgodsway.org
                </p>
              </section>
            </div>
          </ScrollArea>
          <div className="pt-4 border-t border-ministry-steel">
            <Button
              onClick={handleAcceptPrivacy}
              className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-black font-bold uppercase py-3"
            >
              <Check className="w-5 h-5 mr-2" />
              I Accept the Privacy Policy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
