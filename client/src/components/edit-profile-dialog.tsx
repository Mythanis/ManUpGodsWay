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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, MessageSquare, Users, Save, Eye, EyeOff, Trash2, Camera } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProfileData {
  firstName: string;
  lastName: string;
  allowDirectMessages: boolean;
  allowGroupInvites: boolean;
  isProfilePrivate: boolean;
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
    isProfilePrivate: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user && open) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        allowDirectMessages: user.allowDirectMessages ?? true,
        allowGroupInvites: user.allowGroupInvites ?? true,
        isProfilePrivate: (user as any).isProfilePrivate ?? false,
      });
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  }, [user, open]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileData) =>
      apiRequest('PUT', '/api/profile/update', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      // Dialog closing is now handled by handleSave
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      const response = await fetch('/api/profile/upload-picture', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload profile picture');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all queries that might contain user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/discussions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/brothers'] });
      toast({
        title: "Profile Picture Uploaded",
        description: "Your profile picture has been updated successfully.",
      });
      setSelectedFile(null);
      setPreviewUrl(null);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your profile picture. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteProfilePictureMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/profile/delete-picture', {}),
    onSuccess: () => {
      // Invalidate all queries that might contain user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/discussions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/brothers'] });
      toast({
        title: "Profile Picture Deleted",
        description: "Your profile picture has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "There was an error deleting your profile picture. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file",
          description: "Please select an image file",
          variant: "destructive",
        });
        event.target.value = ''; // Reset input for retry
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        event.target.value = ''; // Reset input for retry
        return;
      }

      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(result);
      };
      reader.readAsDataURL(file);
    }
    
    // Reset input value to allow re-selection of same file
    event.target.value = '';
  };

  const handleDeletePicture = () => {
    if (window.confirm("Are you sure you want to remove your profile picture?")) {
      deleteProfilePictureMutation.mutate();
    }
  };

  const handleSave = async () => {
    if (!profileData.firstName.trim()) {
      toast({
        title: "First Name Required",
        description: "Please enter your first name.",
        variant: "destructive",
      });
      return;
    }
    if (!profileData.lastName.trim()) {
      toast({
        title: "Last Name Required",
        description: "Please enter your last name.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Upload profile picture first if a new one is selected
      if (selectedFile) {
        await uploadProfilePictureMutation.mutateAsync(selectedFile);
      }
      
      // Then update other profile data
      await updateProfileMutation.mutateAsync(profileData);
      
      // Close dialog on success
      setOpen(false);
    } catch (error) {
      // Errors already handled by individual mutations
      // Just prevent closing the dialog
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto !bg-black !text-white border-2 border-ministry-gold-exact [&_label]:!text-white [&_h3]:!text-ministry-gold-exact [&_h4]:!text-white [&_p]:!text-white/70">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <User className="w-5 h-5 text-ministry-gold-exact" />
            Edit Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Picture */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-ministry-gold-exact uppercase tracking-wide">Profile Picture</h3>
            
            <div className="flex items-center space-x-4">
              <Avatar className="w-20 h-20">
                <AvatarImage 
                  src={previewUrl || (user as any)?.profileImageUrl || ''} 
                  alt={user?.firstName || 'Profile'} 
                />
                <AvatarFallback className="bg-ministry-gold-exact/20 text-white text-xl">
                  {user?.firstName?.[0] || user?.email?.[0].toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="profile-picture-input"
                    data-testid="input-profile-picture"
                  />
                  <Label htmlFor="profile-picture-input">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer border-ministry-gold-exact/50 text-white hover:bg-ministry-gold-exact/20"
                      asChild
                    >
                      <span data-testid="button-choose-picture">
                        <Camera className="w-4 h-4 mr-2" />
                        {selectedFile || (user as any)?.profileImageUrl ? 'Change Picture' : 'Choose Picture'}
                      </span>
                    </Button>
                  </Label>
                </div>
                
                {selectedFile && (
                  <p className="text-sm text-ministry-gold-exact font-medium truncate">
                    New: {selectedFile.name}
                  </p>
                )}
                
                {(user as any)?.profileImageUrl && !selectedFile && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDeletePicture}
                    disabled={deleteProfilePictureMutation.isPending}
                    className="text-red-400 border-red-500/50 hover:bg-red-500/20"
                    data-testid="button-delete-picture"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Picture
                  </Button>
                )}
                
                <p className="text-xs text-white/50">
                  {selectedFile 
                    ? 'Click "Save Changes" below to upload this picture' 
                    : 'Upload an image (max 5MB)'}
                </p>
              </div>
            </div>
          </div>

          <Separator className="bg-ministry-gold-exact/30" />

          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-ministry-gold-exact uppercase tracking-wide">Personal Information</h3>
            
            <div>
              <Label htmlFor="edit-firstName" className="text-white">First Name *</Label>
              <Input
                id="edit-firstName"
                value={profileData.firstName}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                placeholder="Enter your first name"
                className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                data-testid="input-first-name"
              />
            </div>

            <div>
              <Label htmlFor="edit-lastName" className="text-white">Last Name *</Label>
              <Input
                id="edit-lastName"
                value={profileData.lastName}
                onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                placeholder="Enter your last name"
                className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                data-testid="input-last-name"
              />
            </div>
          </div>

          <Separator className="bg-ministry-gold-exact/30" />

          {/* Communication Preferences */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-ministry-gold-exact uppercase tracking-wide">Communication Preferences</h3>
            
            <div className="flex items-center justify-between p-3 border border-white/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <MessageSquare className="w-4 h-4 text-ministry-gold-exact mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-white">Direct Messages</h4>
                  <p className="text-xs text-white/50">
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

            <div className="flex items-center justify-between p-3 border border-white/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <Users className="w-4 h-4 text-ministry-gold-exact mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-white">Group Invites</h4>
                  <p className="text-xs text-white/50">
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
          </div>

          <Separator className="bg-ministry-gold-exact/30" />

          {/* Profile Privacy */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-ministry-gold-exact uppercase tracking-wide">Profile Privacy</h3>
            
            <div className="flex items-center justify-between p-3 border border-white/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <EyeOff className="w-4 h-4 text-ministry-gold-exact mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-white">Hide Profile Information</h4>
                  <p className="text-xs text-white/50">
                    Hide your detailed profile information from other members
                  </p>
                </div>
              </div>
              <Switch
                checked={profileData.isProfilePrivate}
                onCheckedChange={(checked) => 
                  setProfileData({ ...profileData, isProfilePrivate: checked })
                }
              />
            </div>

            <div className="bg-ministry-gold-exact/10 border border-ministry-gold-exact/30 p-3 rounded-lg">
              <p className="text-xs text-white/70">
                <strong className="text-ministry-gold-exact">Privacy Note:</strong> When enabled, other members will only see your profile picture and action buttons (message, silence, report). Your statistics and detailed information will be hidden. Communication preferences above control messaging functionality.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-white/30 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateProfileMutation.isPending || uploadProfilePictureMutation.isPending}
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
              data-testid="button-save-profile"
            >
              <Save className="w-4 h-4 mr-2" />
              {uploadProfilePictureMutation.isPending 
                ? 'Uploading...' 
                : updateProfileMutation.isPending 
                  ? 'Saving...' 
                  : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}