import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Image, Settings, Eye } from "lucide-react";

interface LogoSettings {
  id: string;
  logoUrl?: string;
  splashDurationMs: number;
  backgroundColor: string;
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
  const [backgroundColor, setBackgroundColor] = useState("white");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSplashPreview, setShowSplashPreview] = useState(false);

  // Ministry theme color options
  const colorOptions = [
    { name: "Ministry Gold", value: "ministry-gold", class: "bg-ministry-gold-exact", preview: "#FBD000" },
    { name: "Black", value: "black", class: "bg-black", preview: "#000000" },
    { name: "White", value: "white", class: "bg-white", preview: "#ffffff" },
    { name: "Steel", value: "steel", class: "bg-ministry-steel", preview: "hsl(213, 12%, 47%)" },
    { name: "Slate", value: "slate", class: "bg-ministry-slate", preview: "hsl(215, 16%, 47%)" },
    { name: "Charcoal", value: "charcoal", class: "bg-ministry-charcoal", preview: "hsl(215, 25%, 27%)" },
  ];

  // Get CSS background class for selected color
  const getBackgroundClass = (color: string) => {
    const option = colorOptions.find(opt => opt.value === color);
    return option?.class || "bg-white";
  };

  // Get CSS color value for preview
  const getBackgroundColor = (color: string) => {
    const option = colorOptions.find(opt => opt.value === color);
    return option?.preview || "#ffffff";
  };

  // Fetch current logo settings
  const { data: logoSettings, isLoading } = useQuery<LogoSettings>({
    queryKey: ["/api/logo"],
    retry: false,
  });

  // Update form states when logo settings change
  useEffect(() => {
    if (logoSettings) {
      setSplashDuration(logoSettings.splashDurationMs);
      setBackgroundColor(logoSettings.backgroundColor || 'white');
    }
  }, [logoSettings]);

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

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { splashDurationMs: number; backgroundColor: string }) => {
      const response = await fetch("/api/admin/logo", {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update settings");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Splash screen settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/logo"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
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

      // Check for optimal formats
      if (file.type === 'image/svg+xml') {
        toast({
          title: "Excellent Choice!",
          description: "SVG logos provide the best quality at all sizes.",
        });
      } else if (file.type === 'image/png') {
        toast({
          title: "Good Quality Format",
          description: "PNG files work well for logos. For best results, use high resolution (at least 512x512px).",
        });
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        toast({
          title: "Consider PNG or SVG",
          description: "JPEG can appear pixelated. PNG or SVG formats provide better logo quality.",
          variant: "default",
        });
      }

      setSelectedFile(file);
      
      // Create preview and check resolution for non-SVG files
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(result);
        
        // For raster images, check resolution
        if (file.type !== 'image/svg+xml') {
          const img = document.createElement('img');
          img.onload = () => {
            if (img.width < 256 || img.height < 256) {
              toast({
                title: "Low Resolution Warning",
                description: `Image is ${img.width}x${img.height}px. For crisp display, use at least 512x512px.`,
                variant: "default",
              });
            } else if (img.width >= 512 && img.height >= 512) {
              toast({
                title: "Great Resolution!",
                description: `High resolution image (${img.width}x${img.height}px) will display crispy and clear.`,
              });
            }
          };
          img.src = result;
        }
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
    formData.append('backgroundColor', backgroundColor);

    uploadLogoMutation.mutate(formData);
  };

  const handleSaveSettings = () => {
    if (!logoSettings?.logoUrl) {
      toast({
        title: "No Logo Found",
        description: "Please upload a logo first before updating settings.",
        variant: "destructive",
      });
      return;
    }

    updateSettingsMutation.mutate({
      splashDurationMs: splashDuration,
      backgroundColor: backgroundColor,
    });
  };

  const handlePreviewSplash = () => {
    if (!logoSettings?.logoUrl && !previewUrl) {
      toast({
        title: "No Logo Available",
        description: "Please upload a logo first or select a file to preview.",
        variant: "destructive",
      });
      return;
    }
    setShowSplashPreview(true);
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
                  style={{
                    maxWidth: '320px',
                    maxHeight: '128px'
                  }}
                  loading="eager"
                  decoding="sync"
                />
              </div>
              <div className="text-sm text-ministry-slate text-center space-y-2">
                <p>Splash Duration: {logoSettings.splashDurationMs / 1000} seconds</p>
                <p>Background: {colorOptions.find(opt => opt.value === logoSettings.backgroundColor)?.name || 'White'}</p>
                <p>Uploaded: {new Date(logoSettings.createdAt).toLocaleDateString()}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewSplash}
                  className="flex items-center space-x-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview Splash Screen</span>
                </Button>
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
              accept="image/svg+xml,image/png,image/webp,image/jpeg"
              onChange={handleFileSelect}
              className="mt-1"
            />
            <p className="text-sm text-ministry-slate mt-1">
              <strong>Recommended:</strong> SVG or high-resolution PNG for best quality. 
              <br />
              Supported formats: SVG, PNG, WebP, JPG. Max size: 5MB.
              <br />
              <span className="text-ministry-gold">💡 For crisp logos, use SVG or PNG files at least 512x512px</span>
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
                  style={{
                    maxWidth: '320px',
                    maxHeight: '128px'
                  }}
                  loading="eager"
                  decoding="sync"
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

          <div>
            <Label htmlFor="background-color">Background Color</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setBackgroundColor(color.value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    backgroundColor === color.value
                      ? 'border-ministry-gold ring-2 ring-ministry-gold/20'
                      : 'border-gray-200 hover:border-ministry-steel'
                  }`}
                >
                  <div 
                    className={`w-full h-8 rounded ${color.class} mb-2 border border-gray-200`}
                  ></div>
                  <span className="text-xs font-medium text-ministry-charcoal">
                    {color.name}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-sm text-ministry-slate mt-1">
              Choose a background color that complements your logo.
            </p>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={handlePreviewSplash}
              disabled={!selectedFile && !logoSettings?.logoUrl}
              className="flex-1 flex items-center space-x-2"
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadLogoMutation.isPending}
              className="flex-1 bg-ministry-charcoal hover:bg-ministry-charcoal/90"
            >
              {uploadLogoMutation.isPending ? "Uploading..." : "Upload Logo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {logoSettings?.logoUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Update Settings</span>
            </CardTitle>
            <p className="text-sm text-ministry-slate">
              Update splash screen settings without uploading a new logo
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="update-splash-duration">Splash Screen Duration (seconds)</Label>
              <Input
                id="update-splash-duration"
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

            <div>
              <Label htmlFor="update-background-color">Background Color</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setBackgroundColor(color.value)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      backgroundColor === color.value
                        ? 'border-ministry-gold ring-2 ring-ministry-gold/20'
                        : 'border-gray-200 hover:border-ministry-steel'
                    }`}
                  >
                    <div 
                      className={`w-full h-8 rounded ${color.class} mb-2`}
                      style={color.value === 'charcoal' ? { backgroundColor: color.preview } : {}}
                    ></div>
                    <span className="text-xs font-medium text-ministry-charcoal">
                      {color.name}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-ministry-slate mt-1">
                Choose a background color that complements your logo.
              </p>
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={handlePreviewSplash}
                className="flex-1 flex items-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>Preview Changes</span>
              </Button>
              <Button
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
                className="flex-1 bg-ministry-charcoal hover:bg-ministry-charcoal/90"
              >
                {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Splash Screen Preview Dialog */}
      <Dialog open={showSplashPreview} onOpenChange={setShowSplashPreview}>
        <DialogContent className="max-w-full max-h-full p-0 border-none bg-transparent">
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ 
              backgroundColor: getBackgroundColor(logoSettings?.backgroundColor || backgroundColor),
            }}
          >
            <div className="flex flex-col items-center space-y-4">
              <img
                src={previewUrl || logoSettings?.logoUrl}
                alt="Logo Preview"
                className="max-w-xs max-h-64 object-contain animate-fade-in"
                style={{
                  animation: 'fadeIn 0.6s ease-in-out',
                  maxWidth: '320px',
                  maxHeight: '256px'
                }}
                loading="eager"
                decoding="sync"
              />
              <div className="mt-8 text-center space-y-2">
                <p className="text-ministry-slate text-sm">
                  Preview: This is how your logo will appear to users
                </p>
                <p className="text-ministry-slate text-xs">
                  Duration: {splashDuration / 1000} seconds • Background: {colorOptions.find(opt => opt.value === backgroundColor)?.name}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowSplashPreview(false)}
                  className="mt-4"
                >
                  Close Preview
                </Button>
              </div>
            </div>
            
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.8); }
                to { opacity: 1; transform: scale(1); }
              }
            `}</style>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}