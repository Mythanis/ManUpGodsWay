import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Image, Settings } from "lucide-react";

interface LogoSettings {
  id: string;
  logoUrl?: string;
  splashDurationMs: number;
  isEnabled: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function LogoManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [splashDuration, setSplashDuration] = useState(3000);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch current logo settings
  const { data: logoSettings, isLoading } = useQuery<LogoSettings>({
    queryKey: ["/api/logo"],
    retry: false,
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/admin/logo", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload logo");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo uploaded successfully! Users will see the new logo when they reload the app.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/logo"] });
      setSelectedFile(null);
      setPreviewUrl(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
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
          title: "Invalid File",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a logo image first.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('logo', selectedFile);
    formData.append('splashDurationMs', splashDuration.toString());

    uploadLogoMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading logo settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Image className="w-5 h-5" />
            <span>Current Logo</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logoSettings?.logoUrl ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={logoSettings.logoUrl}
                  alt="Current Logo"
                  className="max-w-xs max-h-32 object-contain rounded-lg border"
                />
              </div>
              <div className="text-sm text-ministry-slate text-center">
                <p>Splash Duration: {logoSettings.splashDurationMs / 1000} seconds</p>
                <p>Uploaded: {new Date(logoSettings.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-ministry-slate">
              <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No logo currently set</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Upload New Logo</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="logo-upload">Logo Image</Label>
            <Input
              id="logo-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="mt-1"
            />
            <p className="text-sm text-ministry-slate mt-1">
              Supported formats: JPG, PNG, GIF, WebP. Max size: 5MB.
            </p>
          </div>

          {previewUrl && (
            <div>
              <Label>Preview</Label>
              <div className="flex justify-center mt-2">
                <img
                  src={previewUrl}
                  alt="Logo Preview"
                  className="max-w-xs max-h-32 object-contain rounded-lg border"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="splash-duration">Splash Screen Duration (seconds)</Label>
            <Input
              id="splash-duration"
              type="number"
              min="1"
              max="10"
              value={splashDuration / 1000}
              onChange={(e) => setSplashDuration(Math.max(1000, Math.min(10000, parseInt(e.target.value) * 1000)))}
              className="mt-1"
            />
            <p className="text-sm text-ministry-slate mt-1">
              How long the logo appears when users open the app (1-10 seconds).
            </p>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadLogoMutation.isPending}
            className="w-full bg-ministry-charcoal hover:bg-ministry-charcoal/90"
          >
            {uploadLogoMutation.isPending ? "Uploading..." : "Upload Logo"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>How It Works</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-ministry-slate space-y-2">
            <p>• The logo appears as a splash screen when users first open the app</p>
            <p>• Only one logo can be active at a time</p>
            <p>• Uploading a new logo automatically replaces the current one</p>
            <p>• Users will see the new logo when they reload or reopen the app</p>
            <p>• The logo is stored securely and loads quickly for all users</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}