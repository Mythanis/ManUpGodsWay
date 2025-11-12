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
import { User, MessageSquare, Users, Save, Eye, EyeOff, Upload, Trash2, Camera } from "lucide-react";
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
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

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

  const handleUploadPicture = async () => {
    if (!selectedFile) return;

    setIsUploadingPicture(true);
    try {
      await uploadProfilePictureMutation.mutateAsync(selectedFile);
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const handleDeletePicture = () => {
    if (window.confirm("Are you sure you want to remove your profile picture?")) {
      deleteProfilePictureMutation.mutate();
    }
  };

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
          {/* Profile Picture */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-ministry-charcoal">Profile Picture</h3>
            
            <div className="flex items-center space-x-4">
              <Avatar className="w-20 h-20">
                <AvatarImage 
                  src={previewUrl || (user as any)?.profileImageUrl || ''} 
                  alt={user?.firstName || 'Profile'} 
                />
                <AvatarFallback className="bg-ministry-gold-exact/20 text-black text-xl">
                  {user?.firstName?.[0] || user?.email?.[0].toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                {!selectedFile && !(user as any)?.profileImageUrl && (
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
                        className="cursor-pointer"
                        asChild
                      >
                        <span data-testid="button-choose-picture">
                          <Camera className="w-4 h-4 mr-2" />
                          Choose Picture
                        </span>
                      </Button>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload an image (max 5MB)
                    </p>
                  </div>
                )}

                {selectedFile && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name}
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleUploadPicture}
                        disabled={isUploadingPicture}
                        className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
                        data-testid="button-upload-picture"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploadingPicture ? 'Uploading...' : 'Upload'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                        }}
                        data-testid="button-cancel-upload"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {!selectedFile && (user as any)?.profileImageUrl && (
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <div>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="profile-picture-change"
                          data-testid="input-change-picture"
                        />
                        <Label htmlFor="profile-picture-change">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            asChild
                          >
                            <span data-testid="button-change-picture">
                              <Camera className="w-4 h-4 mr-2" />
                              Change Picture
                            </span>
                          </Button>
                        </Label>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleDeletePicture}
                        disabled={deleteProfilePictureMutation.isPending}
                        className="text-red-600 border-red-500 hover:bg-red-50"
                        data-testid="button-delete-picture"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

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
                data-testid="input-first-name"
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
                data-testid="input-last-name"
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
          </div>

          <Separator />

          {/* Profile Privacy */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-ministry-charcoal">Profile Privacy</h3>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-start space-x-3">
                <EyeOff className="w-4 h-4 text-ministry-navy mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-ministry-charcoal">Hide Profile Information</h4>
                  <p className="text-xs text-muted-foreground">
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

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Privacy Note:</strong> When enabled, other members will only see your profile picture and action buttons (message, silence, report). Your statistics and detailed information will be hidden. Communication preferences above control messaging functionality.
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