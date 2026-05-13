import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  Camera,
  Upload,
  X,
  Check,
  Bell,
  Scale,
  FileText,
  Crown,
  Shield,
  BookOpen,
  Video,
  Users,
  Sword,
  CalendarClock,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  CURRENT_TERMS_VERSION,
  TERMS_SECTIONS,
  TERMS_INTRO,
  TERMS_CLOSING,
  TERMS_EFFECTIVE_DATE,
} from "@shared/termsContent";
import { useInstallPWA, InstallPWAButton } from "@/components/InstallPWA";

interface SetupData {
  firstName: string;
  lastName: string;
  allowDirectMessages: boolean;
  allowGroupInvites: boolean;
  prayerPermissionsGranted: boolean;
}

// ─── Shared card wrapper ────────────────────────────────────────────────────
function WizardCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-sm overflow-hidden"
        style={{
          background: "#0d0d0d",
          border: "2px solid #FDD000",
          boxShadow: "6px 6px 0px 0px rgba(253,208,0,0.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Progress dots ──────────────────────────────────────────────────────────
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex justify-center gap-2 pt-5 pb-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i + 1 === step ? "20px" : "8px",
            height: "8px",
            background: i + 1 <= step ? "#FDD000" : "rgba(255,255,255,0.15)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Step header ────────────────────────────────────────────────────────────
function StepHeader({
  icon,
  label,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center px-6 pt-4 pb-2">
      <div
        className="w-14 h-14 mx-auto mb-3 rounded-sm flex items-center justify-center"
        style={{
          background: "rgba(253,208,0,0.12)",
          border: "1px solid rgba(253,208,0,0.3)",
        }}
      >
        {icon}
      </div>
      <p
        className="text-xs font-black uppercase tracking-[0.2em] mb-1"
        style={{ color: "#FDD000" }}
      >
        {label}
      </p>
      <h3 className="text-xl font-black text-white uppercase tracking-tight">
        {title}
      </h3>
      <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
        {subtitle}
      </p>
    </div>
  );
}

export function UserSetupWizard({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;
  const trialPromptKey = `hasSeenTrialPrompt:${user?.id ?? "unknown"}`;

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);

  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
    null,
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [setupData, setSetupData] = useState<SetupData>({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    allowDirectMessages: true,
    allowGroupInvites: true,
    prayerPermissionsGranted: false,
  });

  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState("07:30");

  // ── PWA install hook ──
  const { canInstall } = useInstallPWA();

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateProfileMutation = useMutation({
    mutationFn: (data: SetupData) =>
      apiRequest("POST", "/api/profile/setup", {
        ...data,
        isProfileComplete: true,
      }),
    onSuccess: async () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        await apiRequest("PUT", "/api/daily-reminder", {
          enabled: dailyReminderEnabled,
          reminderTime: dailyReminderTime,
          timezone: tz,
        });
      } catch {}
      try {
        await apiRequest("POST", "/api/terms/accept", {
          version: CURRENT_TERMS_VERSION,
          source: "signup",
        });
      } catch {}
      toast({
        title: "Welcome to Man Up God's Way!",
        description: "Your profile has been set up successfully.",
      });
      if (localStorage.getItem(trialPromptKey) === "1") {
        onComplete();
      } else {
        setStep(5);
      }
    },
    onError: () => {
      toast({
        title: "Setup Failed",
        description:
          "There was an error setting up your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePrayerNotificationToggle = (checked: boolean) => {
    if (checked) {
      setShowNotificationDialog(true);
    } else {
      setSetupData({ ...setupData, prayerPermissionsGranted: false });
    }
  };

  const handleAcceptNotificationPermission = async () => {
    setShowNotificationDialog(false);
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setSetupData((prev) => ({ ...prev, prayerPermissionsGranted: true })); // ← fix
        toast({
          title: "Notifications Enabled",
          description: "You'll receive prayer time alerts.",
        });
      } else {
        setSetupData((prev) => ({ ...prev, prayerPermissionsGranted: false })); // ← fix
        toast({
          title: "Notifications Not Enabled",
          description: "You can enable these later in settings.",
        });
      }
    } else {
      setSetupData((prev) => ({ ...prev, prayerPermissionsGranted: false })); // ← fix
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfileImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setProfileImage(null);
    setProfileImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadProfileImage = async () => {
    if (!profileImage) return;
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("profileImage", profileImage);
      const response = await fetch("/api/profile/image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to upload image");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      toast({
        title: "Image Upload Failed",
        description: "You can add a photo later in your profile settings.",
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
          description: "Please enter your first name.",
          variant: "destructive",
        });
        return;
      }
      if (!setupData.lastName.trim()) {
        toast({
          title: "Last Name Required",
          description: "Please enter your last name.",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (profileImage) await uploadProfileImage();
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      updateProfileMutation.mutate(setupData);
    }
  };

  const handleBack = () => {
    if (step > 1 && step < 5) setStep(step - 1);
  };

  // ── Shared footer ──────────────────────────────────────────────────────────
  const Footer = ({
    onBack,
    onNext,
    nextLabel,
    nextDisabled,
  }: {
    onBack?: () => void;
    onNext: () => void;
    nextLabel?: string;
    nextDisabled?: boolean;
  }) => (
    <div className="px-6 pb-6 pt-2 flex gap-3">
      {onBack && (
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 border-white/20 text-white/60 hover:text-white hover:border-white/40 rounded-sm font-black uppercase text-xs h-11"
        >
          Back
        </Button>
      )}
      <Button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 h-11 font-black uppercase text-xs rounded-sm disabled:opacity-40 text-black"
        style={{
          background: "#FDD000",
          border: "2px solid #000",
          boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
        }}
      >
        {nextLabel || "Continue"}
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Name
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 1)
    return (
      <WizardCard>
        <ProgressDots step={1} total={TOTAL_STEPS} />
        <StepHeader
          icon={<User className="w-7 h-7" style={{ color: "#FDD000" }} />}
          label="Step 1 of 5"
          title="Who Are You, Soldier?"
          subtitle="Your name is how the brotherhood will know you"
        />
        <div className="px-6 py-4 space-y-4">
          <div>
            <Label
              htmlFor="firstName"
              className="text-white font-bold text-xs uppercase tracking-wide"
            >
              First Name *
            </Label>
            <Input
              id="firstName"
              value={setupData.firstName}
              onChange={(e) =>
                setSetupData({ ...setupData, firstName: e.target.value })
              }
              placeholder="Enter your first name"
              className="mt-1.5 bg-black border-white/20 text-white rounded-sm focus:border-[#FDD000]"
            />
          </div>
          <div>
            <Label
              htmlFor="lastName"
              className="text-white font-bold text-xs uppercase tracking-wide"
            >
              Last Name *
            </Label>
            <Input
              id="lastName"
              value={setupData.lastName}
              onChange={(e) =>
                setSetupData({ ...setupData, lastName: e.target.value })
              }
              placeholder="Enter your last name"
              className="mt-1.5 bg-black border-white/20 text-white rounded-sm focus:border-[#FDD000]"
            />
          </div>
        </div>
        <Footer
          onNext={handleNext}
          nextDisabled={
            !setupData.firstName.trim() || !setupData.lastName.trim()
          }
        />
      </WizardCard>
    );

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Profile Picture
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 2)
    return (
      <WizardCard>
        <ProgressDots step={2} total={TOTAL_STEPS} />
        <StepHeader
          icon={<Camera className="w-7 h-7" style={{ color: "#FDD000" }} />}
          label="Step 2 of 5"
          title="Put a Face to the Name"
          subtitle="Help your brothers recognize you in the community"
        />
        <div className="px-6 py-4 flex flex-col items-center gap-4">
          {profileImagePreview ? (
            <div className="relative">
              <img
                src={profileImagePreview}
                alt="Profile preview"
                className="w-32 h-32 rounded-full object-cover"
                style={{ border: "3px solid #FDD000" }}
              />
              <button
                onClick={removeImage}
                className="absolute -top-1 -right-1 w-7 h-7 bg-red-600 rounded-full flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 rounded-full flex flex-col items-center justify-center cursor-pointer transition-colors"
              style={{ border: "3px dashed rgba(255,255,255,0.2)" }}
            >
              <Upload
                className="w-8 h-8 mb-1"
                style={{ color: "rgba(255,255,255,0.3)" }}
              />
              <span
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Upload Photo
              </span>
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
              className="w-full border-white/20 text-white rounded-sm"
            >
              <Upload className="w-4 h-4 mr-2" /> Choose Photo
            </Button>
          )}
          <p
            className="text-xs text-center"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            You can always add or change this later in your profile settings.
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex-1 border-white/20 text-white/60 hover:text-white rounded-sm font-black uppercase text-xs h-11"
          >
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => setStep(3)}
            className="flex-1 border-white/20 text-white/60 hover:text-white rounded-sm font-black uppercase text-xs h-11"
          >
            Skip
          </Button>
          <Button
            onClick={handleNext}
            disabled={!profileImage || isUploadingImage}
            className="flex-1 h-11 font-black uppercase text-xs rounded-sm disabled:opacity-40 text-black"
            style={{
              background: "#FDD000",
              border: "2px solid #000",
              boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
            }}
          >
            {isUploadingImage ? "Uploading..." : "Continue"}
          </Button>
        </div>
      </WizardCard>
    );

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Notifications (Daily Reminder + Prayer combined)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 3)
    return (
      <>
        <WizardCard>
          <ProgressDots step={3} total={TOTAL_STEPS} />
          <StepHeader
            icon={<Bell className="w-7 h-7" style={{ color: "#FDD000" }} />}
            label="Step 3 of 5"
            title="Stay in the Fight"
            subtitle="Set up notifications to keep you showing up daily"
          />
          <div className="px-6 py-4 space-y-3">
            {/* Daily Reminder */}
            <div
              className="rounded-sm overflow-hidden"
              style={{ background: "#111", border: "1px solid #222" }}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-start gap-3">
                  <CalendarClock
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    style={{ color: "#FDD000" }}
                  />
                  <div>
                    <p className="text-white font-bold text-sm">
                      Daily Reminder
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Daily nudge to open the app
                    </p>
                  </div>
                </div>
                <Switch
                  checked={dailyReminderEnabled}
                  onCheckedChange={setDailyReminderEnabled}
                />
              </div>
              {dailyReminderEnabled && (
                <div
                  className="px-4 pb-4 pt-1"
                  style={{ borderTop: "1px solid #1e1e1e" }}
                >
                  <p
                    className="text-xs mb-2"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Remind me at:
                  </p>
                  <Select
                    value={dailyReminderTime}
                    onValueChange={setDailyReminderTime}
                  >
                    <SelectTrigger className="w-full bg-black border-white/20 text-white rounded-sm">
                      <SelectValue placeholder="Choose time" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 48 }, (_, i) => {
                        const hh = Math.floor(i / 2)
                          .toString()
                          .padStart(2, "0");
                        const mm = i % 2 === 0 ? "00" : "30";
                        const value = `${hh}:${mm}`;
                        const hour = Math.floor(i / 2);
                        const ampm = hour < 12 ? "AM" : "PM";
                        const displayHour =
                          hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        return (
                          <SelectItem
                            key={value}
                            value={value}
                          >{`${displayHour}:${mm} ${ampm}`}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Prayer Notifications */}
            <div
              className="flex items-center justify-between p-4 rounded-sm"
              style={{ background: "#111", border: "1px solid #222" }}
            >
              <div className="flex items-start gap-3">
                <Bell
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  style={{ color: "#FDD000" }}
                />
                <div>
                  <p className="text-white font-bold text-sm">
                    Prayer Timer Alerts
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Get notified when your prayer time ends
                  </p>
                </div>
              </div>
              <Switch
                checked={setupData.prayerPermissionsGranted}
                onCheckedChange={handlePrayerNotificationToggle}
              />
            </div>

            {/* Privacy note */}
            <div
              className="flex items-start gap-3 p-3 rounded-sm"
              style={{
                background: "rgba(253,208,0,0.06)",
                border: "1px solid rgba(253,208,0,0.15)",
              }}
            >
              <CheckCircle
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{ color: "#FDD000" }}
              />
              <p
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}
              >
                You can change any of these preferences anytime from your
                profile settings.
              </p>
            </div>
          </div>
          <Footer onBack={handleBack} onNext={handleNext} />
        </WizardCard>

        {/* Prayer notification permission dialog */}
        <Dialog
          open={showNotificationDialog}
          onOpenChange={setShowNotificationDialog}
        >
          <DialogContent className="max-w-sm bg-[#0d0d0d] border-2 border-[#FDD000] rounded-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <Bell className="w-5 h-5" style={{ color: "#FDD000" }} />
                Enable Notifications
              </DialogTitle>
            </DialogHeader>
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}
            >
              Your device will ask for permission to send notifications. Tap{" "}
              <strong className="text-white">Allow</strong> to enable prayer
              timer alerts.
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowNotificationDialog(false)}
                className="flex-1 rounded-sm border-white/20 text-white/60"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAcceptNotificationPermission}
                className="flex-1 text-black font-black rounded-sm"
                style={{ background: "#FDD000" }}
              >
                <Bell className="w-4 h-4 mr-2" /> Allow
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Terms & Privacy (clean dedicated step)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 4)
    return (
      <>
        <WizardCard>
          <ProgressDots step={4} total={TOTAL_STEPS} />
          <StepHeader
            icon={<Scale className="w-7 h-7" style={{ color: "#FDD000" }} />}
            label="Step 4 of 5"
            title="One Last Thing"
            subtitle="Read and accept before joining the brotherhood"
          />
          <div className="px-6 py-4 space-y-3">
            {/* Terms */}
            <div
              className="flex items-center gap-4 p-4 rounded-sm cursor-pointer transition-colors"
              style={{
                background: acceptedTerms ? "rgba(253,208,0,0.08)" : "#111",
                border: `1px solid ${acceptedTerms ? "rgba(253,208,0,0.4)" : "#222"}`,
              }}
              onClick={() => !acceptedTerms && setShowTermsDialog(true)}
            >
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0"
                style={{ background: acceptedTerms ? "#FDD000" : "#1e1e1e" }}
              >
                {acceptedTerms ? (
                  <Check className="w-4 h-4 text-black" />
                ) : (
                  <Scale
                    className="w-4 h-4"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">
                  Terms &amp; Conditions
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{
                    color: acceptedTerms ? "#FDD000" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {acceptedTerms ? "✓ Accepted" : "Tap to read and accept"}
                </p>
              </div>
              {!acceptedTerms && (
                <ChevronRight
                  className="w-4 h-4"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                />
              )}
            </div>

            {/* Privacy */}
            <div
              className="flex items-center gap-4 p-4 rounded-sm cursor-pointer transition-colors"
              style={{
                background: acceptedPrivacy ? "rgba(253,208,0,0.08)" : "#111",
                border: `1px solid ${acceptedPrivacy ? "rgba(253,208,0,0.4)" : "#222"}`,
              }}
              onClick={() => !acceptedPrivacy && setShowPrivacyDialog(true)}
            >
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0"
                style={{ background: acceptedPrivacy ? "#FDD000" : "#1e1e1e" }}
              >
                {acceptedPrivacy ? (
                  <Check className="w-4 h-4 text-black" />
                ) : (
                  <FileText
                    className="w-4 h-4"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">Privacy Policy</p>
                <p
                  className="text-xs mt-0.5"
                  style={{
                    color: acceptedPrivacy
                      ? "#FDD000"
                      : "rgba(255,255,255,0.4)",
                  }}
                >
                  {acceptedPrivacy ? "✓ Accepted" : "Tap to read and accept"}
                </p>
              </div>
              {!acceptedPrivacy && (
                <ChevronRight
                  className="w-4 h-4"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                />
              )}
            </div>

            <p
              className="text-xs text-center"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              You must read and accept both documents to continue.
            </p>
          </div>

          <Footer
            onBack={handleBack}
            onNext={handleNext}
            nextLabel={
              updateProfileMutation.isPending
                ? "Setting up..."
                : "Complete Setup"
            }
            nextDisabled={
              !acceptedTerms ||
              !acceptedPrivacy ||
              updateProfileMutation.isPending
            }
          />
        </WizardCard>

        {/* Terms dialog */}
        <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
          <DialogContent className="max-w-lg max-h-[80vh] bg-[#0d0d0d] border-2 border-[#FDD000] rounded-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <Scale className="w-5 h-5" style={{ color: "#FDD000" }} />
                Terms &amp; Conditions
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[50vh] pr-4">
              <div className="text-white space-y-4">
                <p className="text-gray-400 text-sm">
                  Effective Date: {TERMS_EFFECTIVE_DATE}
                </p>
                <p className="text-gray-300 text-sm leading-relaxed italic">
                  {TERMS_INTRO}
                </p>
                {TERMS_SECTIONS.map((section) => (
                  <section key={section.id}>
                    <h2
                      className="text-base font-bold uppercase mb-2"
                      style={{ color: "#FDD000" }}
                    >
                      {section.heading}
                    </h2>
                    {section.intro && (
                      <p className="text-gray-300 text-sm leading-relaxed mb-1">
                        {section.intro}
                      </p>
                    )}
                    {section.body && (
                      <p
                        className={`text-sm leading-relaxed mb-1 ${section.allCaps ? "text-gray-200 font-semibold" : "text-gray-300"}`}
                      >
                        {section.body}
                      </p>
                    )}
                    {section.bullets && (
                      <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mb-1">
                        {section.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {section.closing && (
                      <p className="text-gray-300 text-sm leading-relaxed mt-1 whitespace-pre-line">
                        {section.closing}
                      </p>
                    )}
                    {section.subsections && (
                      <div className="space-y-3 mt-2">
                        {section.subsections.map((sub) => (
                          <div key={sub.id}>
                            <h3
                              className="text-sm font-semibold mb-1"
                              style={{ color: "#FDD000" }}
                            >
                              {sub.heading}
                            </h3>
                            {sub.body && (
                              <p
                                className={`text-sm leading-relaxed mb-1 ${sub.allCaps ? "text-gray-200 font-semibold" : "text-gray-300"}`}
                              >
                                {sub.body}
                              </p>
                            )}
                            {sub.bullets && (
                              <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mb-1">
                                {sub.bullets.map((b, i) => (
                                  <li key={i}>{b}</li>
                                ))}
                              </ul>
                            )}
                            {sub.closing && (
                              <p className="text-gray-300 text-sm leading-relaxed mt-1 whitespace-pre-line">
                                {sub.closing}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
                <p
                  className="text-sm font-semibold italic leading-relaxed"
                  style={{ color: "#FDD000" }}
                >
                  {TERMS_CLOSING}
                </p>
              </div>
            </ScrollArea>
            <div className="pt-4" style={{ borderTop: "1px solid #222" }}>
              <Button
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTermsDialog(false);
                }}
                className="w-full text-black font-black uppercase rounded-sm py-3"
                style={{ background: "#FDD000" }}
              >
                <Check className="w-5 h-5 mr-2" /> I Accept the Terms &amp;
                Conditions
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Privacy dialog */}
        <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
          <DialogContent className="max-w-lg max-h-[80vh] bg-[#0d0d0d] border-2 border-[#FDD000] rounded-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <FileText className="w-5 h-5" style={{ color: "#FDD000" }} />
                Privacy Policy
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[50vh] pr-4">
              <div className="text-white space-y-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">
                    Effective Date: 1/9/2026
                  </p>
                  <p className="text-gray-400 text-sm mb-1">
                    App Name: ManUp God's Way
                  </p>
                  <p className="text-gray-400 text-sm">
                    Operated By: ManUp God's Way
                  </p>
                </div>
                {[
                  {
                    title: "1. Introduction",
                    body: 'ManUp God\'s Way ("we," "us," or "our") respects your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use our mobile application or related services ("the App").',
                  },
                  {
                    title: "2. Information We Collect",
                    body: "We collect only information you voluntarily provide:",
                    bullets: [
                      "First name",
                      "Last name",
                      "Email address",
                      "Testimony content (text)",
                      "Uploaded pictures/images",
                    ],
                  },
                  {
                    title: "3. How We Use Your Information",
                    body: "We use your information solely to:",
                    bullets: [
                      "Operate and support the App",
                      "Display or manage submitted testimonies and content",
                      "Communicate with you",
                      "Send ministry-related emails",
                      "Maintain safety, integrity, and functionality of the App",
                    ],
                    closing:
                      "We do not use your data for advertising, tracking, or profiling.",
                  },
                  {
                    title: "4. Third-Party Services",
                    body: "We do not sell or share your data. We use Mailchimp (email only) and Replit (hosting infrastructure) as service providers.",
                  },
                  {
                    title: "5. Data Retention",
                    body: "We retain your data only as long as needed for ministry and app operations unless legally required otherwise.",
                  },
                  {
                    title: "6. Security",
                    body: "We use commercially reasonable administrative, technical, and organizational safeguards. No system is 100% secure.",
                  },
                  {
                    title: "7. Your Rights & Data Deletion",
                    body: "You may request a copy of your data or full deletion by emailing info@manupgodsway.org.",
                  },
                  {
                    title: "8. Children's Privacy",
                    body: "Not intended for children under 13.",
                  },
                  {
                    title: "9. No Tracking",
                    body: "We do not track users across apps or websites.",
                  },
                  {
                    title: "10. Changes",
                    body: "We may update this policy. Continued use means acceptance.",
                  },
                  { title: "11. Contact", body: "info@manupgodsway.org" },
                ].map((s) => (
                  <section key={s.title}>
                    <h2
                      className="text-base font-bold uppercase mb-2"
                      style={{ color: "#FDD000" }}
                    >
                      {s.title}
                    </h2>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {s.body}
                    </p>
                    {s.bullets && (
                      <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mt-2">
                        {s.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {s.closing && (
                      <p className="text-gray-300 text-sm leading-relaxed mt-2">
                        {s.closing}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            </ScrollArea>
            <div className="pt-4" style={{ borderTop: "1px solid #222" }}>
              <Button
                onClick={() => {
                  setAcceptedPrivacy(true);
                  setShowPrivacyDialog(false);
                }}
                className="w-full text-black font-black uppercase rounded-sm py-3"
                style={{ background: "#FDD000" }}
              >
                <Check className="w-5 h-5 mr-2" /> I Accept the Privacy Policy
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5 — Trial Prompt + PWA Install
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 5)
    return (
      <WizardCard>
        <ProgressDots step={5} total={TOTAL_STEPS} />
        <div className="px-6 pt-4 pb-2 text-center">
          <div
            className="w-14 h-14 mx-auto mb-3 rounded-sm flex items-center justify-center"
            style={{
              background: "rgba(253,208,0,0.12)",
              border: "1px solid rgba(253,208,0,0.3)",
            }}
          >
            <Crown className="w-7 h-7" style={{ color: "#FDD000" }} />
          </div>
          <p
            className="text-xs font-black uppercase tracking-[0.2em] mb-1"
            style={{ color: "#FDD000" }}
          >
            You're In, Soldier
          </p>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">
            Unlock the Full Mission
          </h3>
          <p
            className="text-sm mt-1"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Start your free 7-day trial — no charge until it ends, no credit
            card required.
          </p>
        </div>

        <div className="px-6 py-3 space-y-2">
          {[
            {
              icon: (
                <BookOpen className="w-4 h-4" style={{ color: "#FDD000" }} />
              ),
              text: "Full Bible study library + 365-day reading plans",
            },
            {
              icon: <Video className="w-4 h-4" style={{ color: "#FDD000" }} />,
              text: "Complete video & podcast library",
            },
            {
              icon: <Users className="w-4 h-4" style={{ color: "#FDD000" }} />,
              text: "Community, War Room & War Groups",
            },
            {
              icon: <Sword className="w-4 h-4" style={{ color: "#FDD000" }} />,
              text: "Weekly challenges & rank progression",
            },
            {
              icon: <Shield className="w-4 h-4" style={{ color: "#FDD000" }} />,
              text: "Under Fire accountability network",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm"
              style={{ background: "#111", border: "1px solid #1e1e1e" }}
            >
              {item.icon}
              <span className="text-sm text-white">{item.text}</span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-2 space-y-3">
          <Button
            onClick={async () => {
              localStorage.setItem(trialPromptKey, "1");
              try {
                const response = await fetch('/api/start-trial', { method: 'POST' });
                if (response.ok) {
                  onComplete();
                } else {
                  window.location.href = "/subscribe";
                }
              } catch {
                window.location.href = "/subscribe";
              }
            }}
            className="w-full py-3 text-lg font-black uppercase tracking-wider text-black rounded-sm"
            style={{
              background: "#FDD000",
              border: "2px solid #000",
              boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)",
            }}
          >
            <Crown className="w-5 h-5 mr-2" />
            Start Free Trial — 7 Days Free
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.setItem(trialPromptKey, "1");
              onComplete();
            }}
            className="w-full rounded-sm border-white/15 font-black uppercase text-xs h-10"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Maybe Later
          </Button>
          <p
            className="text-center text-xs"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            No credit card required. Cancel anytime before trial ends.
          </p>
        </div>

        {/* PWA Install — only shows if app not already installed */}
        {canInstall && (
          <div
            className="mx-6 mb-6 p-4 rounded-sm flex items-center gap-3"
            style={{
              background: "#111",
              border: "1px solid rgba(253,208,0,0.2)",
            }}
          >
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Add to Home Screen</p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Install the app for the full experience
              </p>
            </div>
            <InstallPWAButton />
          </div>
        )}
      </WizardCard>
    );

  return null;
}
