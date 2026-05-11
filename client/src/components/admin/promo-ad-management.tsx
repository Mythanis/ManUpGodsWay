import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, CheckCircle, Circle, ExternalLink, Upload, X, ImageIcon } from "lucide-react";

interface PromoAd {
  id: number;
  title: string;
  description: string | null;
  linkUrl: string;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = { title: "", description: "", linkUrl: "", imageUrl: "", displayOrder: 0 };

export default function PromoAdManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingAd, setEditingAd] = useState<PromoAd | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: ads = [], isLoading } = useQuery<PromoAd[]>({
    queryKey: ["/api/admin/promo-ads"],
    queryFn: () => fetch("/api/admin/promo-ads", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => apiRequest("POST", "/api/admin/promo-ads", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-ads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-ads/active"] });
      toast({ title: "Ad created" });
      setShowDialog(false);
      setForm(emptyForm);
    },
    onError: () => toast({ title: "Failed to create ad", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof emptyForm> }) =>
      apiRequest("PUT", `/api/admin/promo-ads/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-ads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-ads/active"] });
      toast({ title: "Ad updated" });
      setShowDialog(false);
      setEditingAd(null);
      setForm(emptyForm);
    },
    onError: () => toast({ title: "Failed to update ad", variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/promo-ads/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-ads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-ads/active"] });
      toast({ title: "Ad added to carousel" });
    },
    onError: () => toast({ title: "Failed to activate ad", variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/promo-ads/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-ads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-ads/active"] });
      toast({ title: "Ad removed from carousel" });
    },
    onError: () => toast({ title: "Failed to deactivate ad", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/promo-ads/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-ads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-ads/active"] });
      toast({ title: "Ad deleted" });
    },
    onError: () => toast({ title: "Failed to delete ad", variant: "destructive" }),
  });

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/admin/promo-ads/upload-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const { imageUrl } = await res.json();
      setForm(f => ({ ...f, imageUrl }));
      toast({ title: "Image uploaded" });
    } catch {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const openCreate = () => {
    setEditingAd(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (ad: PromoAd) => {
    setEditingAd(ad);
    setForm({
      title: ad.title,
      description: ad.description ?? "",
      linkUrl: ad.linkUrl,
      imageUrl: ad.imageUrl ?? "",
      displayOrder: ad.displayOrder,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.linkUrl.trim()) {
      toast({ title: "Title and link URL are required", variant: "destructive" });
      return;
    }
    const payload = { ...form, displayOrder: Number(form.displayOrder) || 0 };
    if (editingAd) {
      updateMutation.mutate({ id: editingAd.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending || isUploading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">
          Active ads rotate in a carousel on the home screen. Use Display Order to control sequence. Recommended thumbnail: <strong>1200 × 500px</strong>.
        </p>
        <Button onClick={openCreate} className="bg-[#FDD000] text-black font-black hover:bg-yellow-400 flex items-center gap-1 shrink-0 ml-4">
          <Plus className="w-4 h-4" /> New Ad
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading…</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-sm">
          No ads yet. Click "New Ad" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map(ad => (
            <div key={ad.id} className={`border-2 rounded-sm overflow-hidden ${ad.isActive ? 'border-[#FDD000] bg-yellow-50' : 'border-gray-200 bg-white'}`}>
              {ad.imageUrl && (
                <div className="w-full h-28 bg-gray-100 relative overflow-hidden">
                  <img
                    src={ad.imageUrl}
                    alt={ad.title}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="p-4 flex items-start gap-3">
                {!ad.imageUrl && (
                  <div className="w-10 h-10 rounded-sm bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-sm text-gray-900 truncate">{ad.title}</span>
                    {ad.isActive && <Badge className="bg-[#FDD000] text-black text-xs font-bold shrink-0">ACTIVE</Badge>}
                    <span className="text-xs text-gray-400 shrink-0">#{ad.displayOrder}</span>
                  </div>
                  {ad.description && <p className="text-xs text-gray-500 mb-1 line-clamp-2">{ad.description}</p>}
                  <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline flex items-center gap-1 truncate">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {ad.linkUrl}
                  </a>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => ad.isActive ? deactivateMutation.mutate(ad.id) : activateMutation.mutate(ad.id)}
                    disabled={activateMutation.isPending || deactivateMutation.isPending}
                    className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-sm border transition-colors"
                    style={ad.isActive
                      ? { borderColor: '#d97706', color: '#d97706' }
                      : { borderColor: '#16a34a', color: '#16a34a' }}
                  >
                    {ad.isActive ? <Circle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                    {ad.isActive ? 'Remove' : 'Show'}
                  </button>
                  <button
                    onClick={() => openEdit(ad)}
                    className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(ad.id)}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-sm border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-wide">
              {editingAd ? "Edit Ad" : "New Ad"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="ad-title">Title *</Label>
              <Input
                id="ad-title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Man Up Store — New Gear Available"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ad-description">Description (optional)</Label>
              <Textarea
                id="ad-description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short subtitle shown as overlay on the image"
                rows={2}
              />
            </div>

            {/* Thumbnail upload */}
            <div className="space-y-2">
              <Label>Thumbnail Image (optional)</Label>
              <p className="text-xs text-gray-400">Recommended: 1200 × 500px. The image fills the banner; title and description appear as an overlay.</p>

              {form.imageUrl ? (
                <div className="relative rounded-sm overflow-hidden">
                  <img
                    src={form.imageUrl}
                    alt="Thumbnail preview"
                    className="w-full object-cover rounded-sm"
                    style={{ aspectRatio: "2.4/1" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <button
                    onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                    title="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full border-2 border-dashed border-gray-300 rounded-sm py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      <span className="text-sm">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      <span className="text-sm font-medium">Click to upload thumbnail</span>
                      <span className="text-xs">JPG, PNG, WebP — max 5MB</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFile(file);
                  e.target.value = "";
                }}
              />
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-xs text-blue-500 underline"
                >
                  Replace image
                </button>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="ad-link">Link URL *</Label>
              <Input
                id="ad-link"
                value={form.linkUrl}
                onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                placeholder="https://store.manupgodsway.org"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ad-order">Display Order</Label>
              <Input
                id="ad-order"
                type="number"
                value={form.displayOrder}
                onChange={e => setForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
              <p className="text-xs text-gray-400">Lower numbers appear first in the carousel.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={isBusy} className="flex-1 bg-[#FDD000] text-black font-black hover:bg-yellow-400">
                {isBusy ? "Saving…" : editingAd ? "Save Changes" : "Create Ad"}
              </Button>
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
