import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Edit, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CarouselItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkType: string;
  linkId: string | null;
  externalUrl: string | null;
  position: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

const PAGE_LINK_TYPES = [
  { value: "page_library", label: "Library Page", path: "/library" },
  { value: "page_videos", label: "Videos Page", path: "/videos" },
  { value: "page_podcasts", label: "Podcasts Page", path: "/podcasts" },
  { value: "page_challenges", label: "Challenges Page", path: "/challenges" },
  { value: "page_fitness", label: "Fitness Page", path: "/fitness" },
  { value: "page_events", label: "Events Page", path: "/events" },
  { value: "page_community", label: "Community Page", path: "/community" },
  { value: "page_brothers", label: "Brothers Page", path: "/brothers" },
  { value: "page_discipleship", label: "Discipleship Page", path: "/discipleship" },
  { value: "page_war_room", label: "War Room Page", path: "/hurdle-wall" },
  { value: "page_war_groups", label: "War Groups Page", path: "/war-groups" },
  { value: "page_bible", label: "Bible Page", path: "/bible" },
  { value: "page_more_man_up", label: "More Man Up Page", path: "/more-man-up" },
];

const CONTENT_LINK_TYPES = [
  { value: "study", label: "Specific Study" },
  { value: "video", label: "Specific Video" },
  { value: "podcast", label: "Specific Podcast" },
  { value: "devotional", label: "Specific Devotional" },
  { value: "challenge", label: "Specific Challenge" },
  { value: "event", label: "Specific Event" },
];

export default function CarouselManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CarouselItem | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    linkType: "page_library",
    linkId: "",
    externalUrl: "",
    position: 1,
    displayOrder: 0,
  });

  const { data: carouselItems = [] } = useQuery<CarouselItem[]>({
    queryKey: ['/api/admin/carousel'],
  });

  // Fetch content lists for dropdowns
  const { data: studies = [] } = useQuery({
    queryKey: ['/api/studies'],
    enabled: formData.linkType === 'study',
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['/api/videos'],
    enabled: formData.linkType === 'video',
  });

  const { data: podcasts = [] } = useQuery({
    queryKey: ['/api/podcasts'],
    enabled: formData.linkType === 'podcast',
  });

  const { data: devotionals = [] } = useQuery({
    queryKey: ['/api/devotionals'],
    enabled: formData.linkType === 'devotional',
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ['/api/challenges'],
    enabled: formData.linkType === 'challenge',
  });

  const { data: events = [] } = useQuery({
    queryKey: ['/api/events'],
    enabled: formData.linkType === 'event',
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await fetch('/api/admin/carousel', {
        method: 'POST',
        credentials: 'include',
        body: data,
      }).then(res => {
        if (!res.ok) throw new Error('Failed to create carousel item');
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/carousel'] });
      queryClient.invalidateQueries({ queryKey: ['/api/carousel'] });
      toast({
        title: "Success",
        description: "Carousel item created successfully",
      });
      setShowDialog(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create carousel item",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      return await fetch(`/api/admin/carousel/${id}`, {
        method: 'PUT',
        credentials: 'include',
        body: data,
      }).then(res => {
        if (!res.ok) throw new Error('Failed to update carousel item');
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/carousel'] });
      queryClient.invalidateQueries({ queryKey: ['/api/carousel'] });
      toast({
        title: "Success",
        description: "Carousel item updated successfully",
      });
      setShowDialog(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update carousel item",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/carousel/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/carousel'] });
      queryClient.invalidateQueries({ queryKey: ['/api/carousel'] });
      toast({
        title: "Success",
        description: "Carousel item deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete carousel item",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const formData = new FormData();
      formData.append('isActive', String(isActive));
      return await fetch(`/api/admin/carousel/${id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      }).then(res => {
        if (!res.ok) throw new Error('Failed to toggle carousel item');
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/carousel'] });
      queryClient.invalidateQueries({ queryKey: ['/api/carousel'] });
      toast({
        title: "Success",
        description: "Carousel item status updated",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      linkType: "page_library",
      linkId: "",
      externalUrl: "",
      position: 1,
      displayOrder: 0,
    });
    setImageFile(null);
    setEditingItem(null);
  };

  const isPageLink = formData.linkType.startsWith('page_');
  const isContentLink = ['study', 'video', 'podcast', 'devotional', 'challenge', 'event'].includes(formData.linkType);
  
  const getPagePath = (linkType: string) => {
    const page = PAGE_LINK_TYPES.find(p => p.value === linkType);
    return page?.path || '';
  };
  
  const getLinkTypeLabelForItem = (item: CarouselItem) => {
    // Check if it's a page link stored as external
    if (item.linkType === 'external' && item.externalUrl) {
      const matchedPage = PAGE_LINK_TYPES.find(p => p.path === item.externalUrl);
      if (matchedPage) return matchedPage.label;
      return 'External Link';
    }
    
    const page = PAGE_LINK_TYPES.find(p => p.value === item.linkType);
    if (page) return page.label;
    const content = CONTENT_LINK_TYPES.find(c => c.value === item.linkType);
    if (content) return content.label;
    return item.linkType;
  };

  const handleEdit = (item: CarouselItem) => {
    setEditingItem(item);
    
    // Detect if this is a page link based on external URL path
    let linkType = item.linkType;
    if (item.linkType === 'external' && item.externalUrl) {
      const matchedPage = PAGE_LINK_TYPES.find(p => p.path === item.externalUrl);
      if (matchedPage) {
        linkType = matchedPage.value;
      }
    }
    
    setFormData({
      title: item.title,
      description: item.description || "",
      linkType: linkType,
      linkId: item.linkId || "",
      externalUrl: item.externalUrl || "",
      position: item.position,
      displayOrder: item.displayOrder,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.title) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    if (!imageFile && !editingItem) {
      toast({
        title: "Validation Error",
        description: "Image is required for new carousel items",
        variant: "destructive",
      });
      return;
    }

    // Validate linkId for content types that require selection
    if (formData.linkType === "study" && !formData.linkId) {
      toast({
        title: "Validation Error",
        description: "Please select a study",
        variant: "destructive",
      });
      return;
    }

    // Validate externalUrl for external links
    if (formData.linkType === "external" && !formData.externalUrl) {
      toast({
        title: "Validation Error",
        description: "External URL is required for external links",
        variant: "destructive",
      });
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    
    // For page links, store as external with the page path
    if (isPageLink) {
      data.append('linkType', 'external');
      data.append('externalUrl', getPagePath(formData.linkType));
      data.append('linkId', '');
    } else {
      data.append('linkType', formData.linkType);
      data.append('linkId', formData.linkId);
      data.append('externalUrl', formData.externalUrl);
    }
    
    data.append('position', String(formData.position));
    data.append('displayOrder', String(formData.displayOrder));
    
    if (imageFile) {
      data.append('image', imageFile);
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-ministry-slate">
          Manage featured content carousel on the homepage (1 large + 2 small images)
        </p>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
          data-testid="button-add-carousel-item"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Carousel Item
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carouselItems.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="relative">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-48 object-cover"
              />
              {!item.isActive && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-bold">INACTIVE</span>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-ministry-gold text-black px-2 py-1 rounded text-xs font-bold">
                Position {item.position}
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-bold text-ministry-charcoal mb-1">{item.title}</h3>
              {item.description && (
                <p className="text-sm text-ministry-slate mb-2 line-clamp-2">{item.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-ministry-slate mb-3">
                <span>Type: {getLinkTypeLabelForItem(item)}</span>
                <span>Order: {item.displayOrder}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(item)}
                  data-testid={`button-edit-carousel-${item.id}`}
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: !item.isActive })}
                  data-testid={`button-toggle-carousel-${item.id}`}
                >
                  {item.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this carousel item?")) {
                      deleteMutation.mutate(item.id);
                    }
                  }}
                  data-testid={`button-delete-carousel-${item.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Carousel Item" : "Add Carousel Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="carousel-title">Title *</Label>
              <Input
                id="carousel-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter title"
                data-testid="input-carousel-title"
              />
            </div>

            <div>
              <Label htmlFor="carousel-description">Description</Label>
              <Textarea
                id="carousel-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                data-testid="input-carousel-description"
              />
            </div>

            <div>
              <Label htmlFor="carousel-image">Image {!editingItem && "*"}</Label>
              <Input
                id="carousel-image"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                data-testid="input-carousel-image"
              />
              {editingItem && !imageFile && (
                <p className="text-xs text-ministry-slate mt-1">Leave empty to keep current image</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="carousel-link-type">Link Type *</Label>
                <Select
                  value={formData.linkType}
                  onValueChange={(value) => setFormData({ ...formData, linkType: value, linkId: "", externalUrl: "" })}
                >
                  <SelectTrigger id="carousel-link-type" data-testid="select-carousel-link-type">
                    <SelectValue placeholder="Select link type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectGroup>
                      <SelectLabel className="font-bold text-ministry-charcoal">Pages (Full Page)</SelectLabel>
                      {PAGE_LINK_TYPES.map((page) => (
                        <SelectItem key={page.value} value={page.value}>
                          {page.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="font-bold text-ministry-charcoal">Specific Content</SelectLabel>
                      {CONTENT_LINK_TYPES.map((content) => (
                        <SelectItem key={content.value} value={content.value}>
                          {content.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="font-bold text-ministry-charcoal">Other</SelectLabel>
                      <SelectItem value="external">Custom External URL</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="carousel-position">Position *</Label>
                <Select
                  value={String(formData.position)}
                  onValueChange={(value) => setFormData({ ...formData, position: parseInt(value) })}
                >
                  <SelectTrigger id="carousel-position" data-testid="select-carousel-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Large - Top)</SelectItem>
                    <SelectItem value="2">2 (Small - Bottom Left)</SelectItem>
                    <SelectItem value="3">3 (Small - Bottom Right)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isPageLink && (
              <div className="bg-ministry-gold/10 p-3 rounded-lg border border-ministry-gold/30">
                <p className="text-sm text-ministry-charcoal">
                  <strong>Links to:</strong> {getPagePath(formData.linkType)}
                </p>
                <p className="text-xs text-ministry-slate mt-1">
                  This carousel item will navigate to the full page when clicked.
                </p>
              </div>
            )}

            {formData.linkType === "external" && (
              <div>
                <Label htmlFor="carousel-external-url">External URL *</Label>
                <Input
                  id="carousel-external-url"
                  value={formData.externalUrl}
                  onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                  placeholder="https://example.com"
                  data-testid="input-carousel-external-url"
                />
              </div>
            )}

            {formData.linkType === "study" && (
              <div>
                <Label htmlFor="carousel-content">Select Study *</Label>
                <Select
                  value={formData.linkId}
                  onValueChange={(value) => setFormData({ ...formData, linkId: value })}
                >
                  <SelectTrigger id="carousel-content" data-testid="select-carousel-content">
                    <SelectValue placeholder="Choose a study" />
                  </SelectTrigger>
                  <SelectContent>
                    {(studies as any[]).map((study: any) => (
                      <SelectItem key={study.id} value={study.id}>
                        {study.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.linkType === "video" && (
              <div>
                <Label htmlFor="carousel-content">Select Video (Optional)</Label>
                <Select
                  value={formData.linkId}
                  onValueChange={(value) => setFormData({ ...formData, linkId: value })}
                >
                  <SelectTrigger id="carousel-content" data-testid="select-carousel-content">
                    <SelectValue placeholder="Choose a video (or leave blank for Videos page)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(videos as any[]).map((video: any) => (
                      <SelectItem key={video.id} value={video.id}>
                        {video.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-ministry-slate mt-1">Leave empty to link to the Videos page</p>
              </div>
            )}

            {formData.linkType === "podcast" && (
              <div>
                <Label htmlFor="carousel-content">Select Podcast (Optional)</Label>
                <Select
                  value={formData.linkId}
                  onValueChange={(value) => setFormData({ ...formData, linkId: value })}
                >
                  <SelectTrigger id="carousel-content" data-testid="select-carousel-content">
                    <SelectValue placeholder="Choose a podcast (or leave blank for Podcasts page)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(podcasts as any[]).map((podcast: any) => (
                      <SelectItem key={podcast.id} value={podcast.id}>
                        {podcast.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-ministry-slate mt-1">Leave empty to link to the Podcasts page</p>
              </div>
            )}

            {formData.linkType === "devotional" && (
              <div>
                <Label htmlFor="carousel-content">Select Devotional (Optional)</Label>
                <Select
                  value={formData.linkId}
                  onValueChange={(value) => setFormData({ ...formData, linkId: value })}
                >
                  <SelectTrigger id="carousel-content" data-testid="select-carousel-content">
                    <SelectValue placeholder="Choose a devotional (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(devotionals as any[]).map((devotional: any) => (
                      <SelectItem key={devotional.id} value={devotional.id}>
                        {devotional.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-ministry-slate mt-1">Leave empty to link to the home page</p>
              </div>
            )}

            {formData.linkType === "challenge" && (
              <div>
                <Label htmlFor="carousel-content">Select Challenge (Optional)</Label>
                <Select
                  value={formData.linkId}
                  onValueChange={(value) => setFormData({ ...formData, linkId: value })}
                >
                  <SelectTrigger id="carousel-content" data-testid="select-carousel-content">
                    <SelectValue placeholder="Choose a challenge (or leave blank for Challenges page)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(challenges as any[]).map((challenge: any) => (
                      <SelectItem key={challenge.id} value={challenge.id}>
                        {challenge.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-ministry-slate mt-1">Leave empty to link to the Challenges page</p>
              </div>
            )}

            {formData.linkType === "event" && (
              <div>
                <Label htmlFor="carousel-content">Select Event (Optional)</Label>
                <Select
                  value={formData.linkId}
                  onValueChange={(value) => setFormData({ ...formData, linkId: value })}
                >
                  <SelectTrigger id="carousel-content" data-testid="select-carousel-content">
                    <SelectValue placeholder="Choose an event (or leave blank for Events page)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(events as any[]).map((event: any) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-ministry-slate mt-1">Leave empty to link to the Events page</p>
              </div>
            )}

            <div>
              <Label htmlFor="carousel-display-order">Display Order</Label>
              <Input
                id="carousel-display-order"
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                placeholder="0"
                data-testid="input-carousel-display-order"
              />
              <p className="text-xs text-ministry-slate mt-1">Lower numbers appear first</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
              data-testid="button-save-carousel"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingItem
                  ? "Update"
                  : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
