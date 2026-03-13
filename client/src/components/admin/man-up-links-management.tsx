import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, GripVertical, ExternalLink, Image } from "lucide-react";
import { FaFacebook, FaTwitter, FaInstagram, FaGlobe, FaTshirt, FaYoutube, FaTiktok, FaLinkedin, FaEnvelope, FaPhone, FaPodcast, FaSpotify } from "react-icons/fa";
import type { ManUpLink } from "@shared/schema";

const ICON_OPTIONS = [
  { value: "facebook", label: "Facebook", component: FaFacebook },
  { value: "twitter", label: "Twitter / X", component: FaTwitter },
  { value: "instagram", label: "Instagram", component: FaInstagram },
  { value: "youtube", label: "YouTube", component: FaYoutube },
  { value: "tiktok", label: "TikTok", component: FaTiktok },
  { value: "linkedin", label: "LinkedIn", component: FaLinkedin },
  { value: "globe", label: "Website", component: FaGlobe },
  { value: "shirt", label: "Merch / Shirt", component: FaTshirt },
  { value: "email", label: "Email", component: FaEnvelope },
  { value: "phone", label: "Phone", component: FaPhone },
  { value: "podcast", label: "Podcast", component: FaPodcast },
  { value: "spotify", label: "Spotify", component: FaSpotify },
];

const COLOR_OPTIONS = [
  { value: "text-black", label: "Black" },
  { value: "text-white", label: "White" },
  { value: "text-blue-600", label: "Blue" },
  { value: "text-blue-400", label: "Light Blue" },
  { value: "text-pink-600", label: "Pink" },
  { value: "text-red-600", label: "Red" },
  { value: "text-green-600", label: "Green" },
  { value: "text-purple-600", label: "Purple" },
  { value: "text-yellow-500", label: "Yellow" },
  { value: "text-orange-500", label: "Orange" },
];

function getIconComponent(iconName: string) {
  const found = ICON_OPTIONS.find((o) => o.value === iconName);
  return found ? found.component : FaGlobe;
}

export default function ManUpLinksManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingLink, setEditingLink] = useState<ManUpLink | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    icon: "globe",
    iconColor: "text-black",
    displayOrder: "0",
    isActive: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const { data: links = [], isLoading } = useQuery<ManUpLink[]>({
    queryKey: ["/api/admin/man-up-links"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/admin/man-up-links", {
        method: "POST",
        body: data,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create link");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/man-up-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/man-up-links"] });
      toast({ title: "Link created successfully" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Failed to create link", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const res = await fetch(`/api/admin/man-up-links/${id}`, {
        method: "PUT",
        body: data,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update link");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/man-up-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/man-up-links"] });
      toast({ title: "Link updated successfully" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Failed to update link", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/man-up-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/man-up-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/man-up-links"] });
      toast({ title: "Link deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete link", variant: "destructive" });
    },
  });

  function openCreateDialog() {
    setEditingLink(null);
    setFormData({
      name: "",
      url: "",
      icon: "globe",
      iconColor: "text-black",
      displayOrder: String(links.length),
      isActive: true,
    });
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setShowDialog(true);
  }

  function openEditDialog(link: ManUpLink) {
    setEditingLink(link);
    setFormData({
      name: link.name,
      url: link.url,
      icon: link.icon,
      iconColor: link.iconColor,
      displayOrder: String(link.displayOrder),
      isActive: link.isActive ?? true,
    });
    setImageFile(null);
    setImagePreview(link.imageUrl || null);
    setRemoveImage(false);
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditingLink(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  function handleSubmit() {
    if (!formData.name || !formData.url) {
      toast({ title: "Name and URL are required", variant: "destructive" });
      return;
    }

    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("url", formData.url);
    fd.append("icon", formData.icon);
    fd.append("iconColor", formData.iconColor);
    fd.append("displayOrder", formData.displayOrder);
    fd.append("isActive", String(formData.isActive));
    if (imageFile) {
      fd.append("image", imageFile);
    }
    if (removeImage) {
      fd.append("removeImage", "true");
    }

    if (editingLink) {
      updateMutation.mutate({ id: editingLink.id, data: fd });
    } else {
      createMutation.mutate(fd);
    }
  }

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading links...</div>;
  }

  const IconPreview = getIconComponent(formData.icon);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{links.length} link(s) configured</p>
        <Button onClick={openCreateDialog} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Link
        </Button>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No links configured. Add your first link above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const LinkIcon = getIconComponent(link.icon);
            return (
              <Card key={link.id}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <div className="w-8 h-8 bg-ministry-gold-exact rounded flex items-center justify-center">
                      {link.imageUrl ? (
                        <img src={link.imageUrl} alt={link.name} className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <LinkIcon className={`w-4 h-4 ${link.iconColor || 'text-black'}`} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{link.name}</span>
                        {!link.isActive && (
                          <Badge variant="secondary" className="text-xs">Hidden</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">#{link.displayOrder}</Badge>
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                      >
                        {link.url.substring(0, 40)}...
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(link)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this link?")) {
                          deleteMutation.mutate(link.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLink ? "Edit Link" : "Add New Link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Facebook, Website, Merch Store"
              />
            </div>
            <div>
              <Label>URL *</Label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Icon</Label>
                <Select value={formData.icon} onValueChange={(v) => setFormData({ ...formData, icon: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Icon Color</Label>
                <Select value={formData.iconColor} onValueChange={(v) => setFormData({ ...formData, iconColor: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-500">Preview:</span>
              <div className="w-10 h-10 bg-ministry-gold-exact rounded flex items-center justify-center border-2 border-black">
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-6 h-6 rounded object-cover" />
                ) : (
                  <IconPreview className="w-5 h-5 text-black" />
                )}
              </div>
              <span className="font-bold text-sm">{formData.name || "Link Name"}</span>
            </div>
            <div>
              <Label>Custom Image (optional, overrides icon)</Label>
              <Input type="file" accept="image/*" onChange={handleImageChange} />
              {imagePreview && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={imagePreview} alt="Preview" className="w-12 h-12 rounded object-cover border" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setRemoveImage(true);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Display Order</Label>
              <Input
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Active (visible to users)</Label>
            </div>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingLink
                  ? "Update Link"
                  : "Create Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}