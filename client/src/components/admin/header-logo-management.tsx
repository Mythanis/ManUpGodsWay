import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Image } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function HeaderLogoManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch current header logo settings
  const { data: headerLogoSettings, isLoading } = useQuery({
    queryKey: ['/api/header-logo'],
    retry: false,
  });

  // Upload header logo mutation
  const uploadHeaderLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch('/api/admin/header-logo', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include session cookies
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload header logo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Header logo uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/header-logo'] });
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload header logo",
        variant: "destructive",
      });
    },
  });

  // Delete header logo mutation
  const deleteHeaderLogoMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/header-logo', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete header logo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Header logo deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/header-logo'] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete header logo",
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
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      await uploadHeaderLogoMutation.mutateAsync(selectedFile);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete the header logo?")) {
      deleteHeaderLogoMutation.mutate();
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="text-center py-8 text-ministry-slate">
        <p>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-ministry-charcoal">Header Logo Management</CardTitle>
          <p className="text-sm text-ministry-slate">
            Manage the logo that appears at the top of all pages (separate from splash screen logo)
          </p>
        </CardHeader>
        <CardContent>
          {(headerLogoSettings as any)?.logoUrl ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={(headerLogoSettings as any).logoUrl}
                  alt="Current Header Logo"
                  className="max-w-xs max-h-32 object-contain rounded-lg border"
                />
              </div>
              <div className="text-sm text-ministry-slate text-center space-y-2">
                <p>Uploaded: {new Date((headerLogoSettings as any).createdAt).toLocaleDateString()}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteHeaderLogoMutation.isPending}
                  className="flex items-center space-x-2 text-red-600 border-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Header Logo</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-ministry-slate">
              <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No header logo currently set</p>
              <p className="text-xs mt-1">The default logo will be used as fallback</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-ministry-charcoal">Upload New Header Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="header-logo-file" className="text-ministry-charcoal">
              Select Image File (Max 5MB)
            </Label>
            <Input
              id="header-logo-file"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="border-ministry-steel"
            />
          </div>

          {selectedFile && (
            <div className="border rounded-lg p-4 bg-ministry-steel/10">
              <h4 className="font-medium text-ministry-charcoal mb-2">Selected File:</h4>
              <p className="text-sm text-ministry-slate">
                <strong>Name:</strong> {selectedFile.name}
              </p>
              <p className="text-sm text-ministry-slate">
                <strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <p className="text-sm text-ministry-slate">
                <strong>Type:</strong> {selectedFile.type}
              </p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || uploadHeaderLogoMutation.isPending}
            className="w-full bg-ministry-charcoal text-white py-3 rounded-xl font-medium hover:bg-ministry-steel"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading || uploadHeaderLogoMutation.isPending ? "Uploading..." : "Upload Header Logo"}
          </Button>

          <div className="text-xs text-ministry-slate space-y-1">
            <p>• Recommended size: 200x60px or similar aspect ratio</p>
            <p>• Supported formats: PNG, JPG, SVG</p>
            <p>• This logo appears at the top center of all authenticated pages</p>
            <p>• Different from the splash screen logo which appears during app loading</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}