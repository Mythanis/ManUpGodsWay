import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, MessageSquare, Users, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProfileData {
  firstName: string;
  lastName: string;
  allowDirectMessages: boolean;
  allowGroupInvites: boolean;
}

export function EditProfileDialog({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    allowDirectMessages: true,
    allowGroupInvites: true,
  });

  useEffect(() => {
    if (user && open) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        allowDirectMessages: user.allowDirectMessages ?? true,
        allowGroupInvites: user.allowGroupInvites ?? true,
      });
    }
  }, [user, open]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileData) =>
      apiRequest('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!profileData.firstName.trim()) {
      toast({
        title: "First Name Required",
        description: "Please enter your first name.",
        variant: "destructive",
      });
      return;
    }
    updateProfileMutation.mutate(profileData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Edit Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-ministry-charcoal">Personal Information</h3>
            
            <div>
              <Label htmlFor="edit-firstName">First Name *</Label>
              <Input
                id="edit-firstName"
                value={profileData.firstName}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                placeholder="Enter your first name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-lastName">Last Name</Label>
              <Input
                id="edit-lastName"
                value={profileData.lastName}
                onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                placeholder="Enter your last name"
                className="mt-1"
              />
            </div>
          </div>

          <Separator />

          {/* Communication Preferences */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-ministry-charcoal">Communication Preferences</h3>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-start space-x-3">
                <MessageSquare className="w-4 h-4 text-ministry-navy mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-ministry-charcoal">Direct Messages</h4>
                  <p className="text-xs text-muted-foreground">
                    Allow other members to send you private messages
                  </p>
                </div>
              </div>
              <Switch
                checked={profileData.allowDirectMessages}
                onCheckedChange={(checked) => 
                  setProfileData({ ...profileData, allowDirectMessages: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-start space-x-3">
                <Users className="w-4 h-4 text-ministry-navy mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-ministry-charcoal">Group Invites</h4>
                  <p className="text-xs text-muted-foreground">
                    Allow other members to invite you to group chats
                  </p>
                </div>
              </div>
              <Switch
                checked={profileData.allowGroupInvites}
                onCheckedChange={(checked) => 
                  setProfileData({ ...profileData, allowGroupInvites: checked })
                }
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Privacy Note:</strong> When disabled, other members won't be able to 
                send you message requests or invite you to new groups. Existing conversations remain active.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateProfileMutation.isPending}
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}