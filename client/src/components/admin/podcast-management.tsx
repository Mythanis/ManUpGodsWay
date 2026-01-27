import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RiversideIntegrationPanel } from "@/components/riverside-integration-panel";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Upload,
  Headphones,
  Video,
  Eye,
  Star,
  Calendar,
  Radio,
  GripVertical
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Podcast {
  id: string;
  title: string;
  description: string;
  type: 'audio' | 'video';
  fileUrl: string;
  thumbnailUrl?: string;
  duration: number;
  category: string;
  tags: string[];
  rating: string;
  ratingCount: number;
  viewCount: number;
  isPublished: boolean;
  isCurrentlyLive?: boolean;
  liveStreamUrl?: string;
  liveStartedAt?: string;
  episodeNumber?: number;
  createdAt: string;
  updatedAt: string;
}

interface SortablePodcastCardProps {
  podcast: Podcast;
  onEdit: (podcast: Podcast) => void;
  onDelete: (id: string) => void;
  formatDuration: (seconds: number) => string;
}

function SortablePodcastCard({ podcast, onEdit, onDelete, formatDuration }: SortablePodcastCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: podcast.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={`hover:shadow-md transition-shadow bg-ministry-gold-exact ${isDragging ? 'shadow-lg ring-2 ring-black' : ''}`}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            <div 
              {...attributes} 
              {...listeners}
              className="flex-shrink-0 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing touch-none"
            >
              <GripVertical className="w-6 h-6 text-black/50" />
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                podcast.type === 'video' 
                  ? 'bg-ministry-steel/20' 
                  : 'bg-black'
              }`}>
                {podcast.type === 'video' ? (
                  <Video className="w-6 h-6 text-ministry-steel" />
                ) : (
                  <Headphones className="w-6 h-6 text-white" />
                )}
              </div>
              {podcast.episodeNumber && (
                <span className="text-xs text-black font-bold">#{podcast.episodeNumber}</span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg text-black mb-1">
                    {podcast.title}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-black mb-2">
                    <Badge variant="outline" className="text-xs">
                      {podcast.type === 'audio' ? 'Audio' : 'Video'}
                    </Badge>
                    <span className="capitalize">{podcast.category}</span>
                    <span>{formatDuration(podcast.duration)}</span>
                    {!podcast.isPublished && (
                      <Badge variant="secondary" className="text-xs">
                        Draft
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {podcast.description && (
                <p className="text-black text-sm mb-3 line-clamp-2">
                  {podcast.description}
                </p>
              )}

              <div className="flex items-center space-x-6 text-sm text-black">
                <div className="flex items-center">
                  <Star className="w-4 h-4 mr-1 text-ministry-gold" />
                  {parseFloat(podcast.rating).toFixed(1)} ({podcast.ratingCount})
                </div>
                <div className="flex items-center">
                  <Eye className="w-4 h-4 mr-1" />
                  {podcast.viewCount} views
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDistanceToNow(new Date(podcast.createdAt), { addSuffix: true })}
                </div>
              </div>

              {podcast.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {podcast.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(podcast)}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(podcast.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PodcastManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPodcast, setEditingPodcast] = useState<Podcast | null>(null);
  const [isImportingRSS, setIsImportingRSS] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'audio' as 'audio' | 'video',
    fileUrl: '',
    thumbnailUrl: '',
    duration: 0,
    category: 'general',
    tags: [] as string[],
    isPublished: true
  });

  // Fetch all podcasts (admin view)
  const { data: podcasts = [], isLoading } = useQuery({
    queryKey: ['admin', 'podcasts'],
    queryFn: async () => {
      const response = await fetch('/api/admin/podcasts', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch podcasts');
      return response.json();
    },
  });

  // Create podcast mutation
  const createPodcastMutation = useMutation({
    mutationFn: (podcastData: any) =>
      fetch('/api/podcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(podcastData),
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'podcasts'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'podcasts'] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "Success",
        description: "Podcast created successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create podcast",
        variant: "destructive"
      });
    }
  });

  // Update podcast mutation
  const updatePodcastMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetch(`/api/podcasts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'podcasts'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'podcasts'] });
      setShowEditDialog(false);
      setEditingPodcast(null);
      resetForm();
      toast({
        title: "Success",
        description: "Podcast updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update podcast",
        variant: "destructive"
      });
    }
  });

  // Delete podcast mutation
  const deletePodcastMutation = useMutation({
    mutationFn: (podcastId: string) =>
      fetch(`/api/podcasts/${podcastId}`, {
        method: 'DELETE',
        credentials: 'include'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'podcasts'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'podcasts'] });
      toast({
        title: "Success",
        description: "Podcast deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete podcast",
        variant: "destructive"
      });
    }
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end - update episode numbers for all affected podcasts
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = podcasts.findIndex((p: Podcast) => p.id === active.id);
    const newIndex = podcasts.findIndex((p: Podcast) => p.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Calculate new order - assign episode numbers based on position (highest at top)
    const reorderedPodcasts = arrayMove([...podcasts], oldIndex, newIndex);
    const totalPodcasts = reorderedPodcasts.length;
    
    // Update all episode numbers based on new positions
    try {
      await Promise.all(
        reorderedPodcasts.map((podcast: Podcast, index: number) => 
          fetch(`/api/podcasts/${podcast.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ episodeNumber: totalPodcasts - index }),
            credentials: 'include'
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'podcasts'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'podcasts'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reorder podcasts",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'audio',
      fileUrl: '',
      thumbnailUrl: '',
      duration: 0,
      category: 'general',
      tags: [],
      isPublished: true
    });
  };

  const handleEdit = (podcast: Podcast) => {
    setEditingPodcast(podcast);
    setFormData({
      title: podcast.title,
      description: podcast.description || '',
      type: podcast.type,
      fileUrl: podcast.fileUrl,
      thumbnailUrl: podcast.thumbnailUrl || '',
      duration: podcast.duration,
      category: podcast.category,
      tags: podcast.tags || [],
      isPublished: podcast.isPublished
    });
    setShowEditDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.fileUrl) {
      toast({
        title: "Error",
        description: "Please fill in required fields (title and file URL)",
        variant: "destructive"
      });
      return;
    }

    if (editingPodcast) {
      updatePodcastMutation.mutate({ id: editingPodcast.id, data: formData });
    } else {
      createPodcastMutation.mutate(formData);
    }
  };

  const handleDelete = (podcastId: string) => {
    if (confirm('Are you sure you want to delete this podcast? This action cannot be undone.')) {
      deletePodcastMutation.mutate(podcastId);
    }
  };

  const handleRSSImport = async () => {
    setIsImportingRSS(true);
    try {
      const response = await fetch('/api/admin/podcasts/import-rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl: 'https://manupgodsway.podomatic.com/rss2.xml' }),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'podcasts'] });
        queryClient.invalidateQueries({ queryKey: ['api', 'podcasts'] });
        toast({
          title: "Success",
          description: `Imported ${result.imported} podcasts. Skipped ${result.skipped} (already exist or errors).`,
        });
      } else {
        throw new Error(result.message || 'Import failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import RSS feed",
        variant: "destructive"
      });
    } finally {
      setIsImportingRSS(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}h`;
    }
    return `${mins}m`;
  };

  const PodcastDialog = ({ isEdit = false }: { isEdit?: boolean }) => (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Podcast' : 'Create New Podcast'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Title *</label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter podcast title"
            className="mt-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter podcast description"
            className="mt-2"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select 
              value={formData.type} 
              onValueChange={(value: 'audio' | 'video') => 
                setFormData(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leadership">Leadership</SelectItem>
                <SelectItem value="marriage">Marriage</SelectItem>
                <SelectItem value="fatherhood">Fatherhood</SelectItem>
                <SelectItem value="character">Character</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">File URL *</label>
          <Input
            value={formData.fileUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, fileUrl: e.target.value }))}
            placeholder="Enter file URL (e.g., /podcasts/audio.mp3)"
            className="mt-2"
          />
        </div>

        {formData.type === 'video' && (
          <div>
            <label className="text-sm font-medium">Thumbnail URL</label>
            <Input
              value={formData.thumbnailUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
              placeholder="Enter thumbnail image URL"
              className="mt-2"
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Duration (seconds)</label>
          <Input
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
            placeholder="Enter duration in seconds"
            className="mt-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Tags (comma-separated)</label>
          <Input
            value={formData.tags.join(', ')}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) 
            }))}
            placeholder="leadership, character, growth"
            className="mt-2"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isPublished"
            checked={formData.isPublished}
            onChange={(e) => setFormData(prev => ({ ...prev, isPublished: e.target.checked }))}
            className="rounded border-gray-300"
          />
          <label htmlFor="isPublished" className="text-sm font-medium">Published</label>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              if (isEdit) {
                setShowEditDialog(false);
                setEditingPodcast(null);
              } else {
                setShowCreateDialog(false);
              }
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createPodcastMutation.isPending || updatePodcastMutation.isPending}
            className="bg-ministry-gold hover:bg-ministry-gold/90"
          >
            {isEdit ? 'Update' : 'Create'} Podcast
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  return (
    <div className="space-y-6">
      {/* Riverside.fm Integration Panel */}
      <RiversideIntegrationPanel />

      {/* RSS Feed Import Section */}
      <Card className="border border-ministry-charcoal bg-ministry-gold-exact">
        <CardHeader>
          <CardTitle className="flex items-center text-black">
            <Radio className="w-5 h-5 mr-2" />
            Import from RSS Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-black mb-4">
            Sync podcasts from your Podomatic RSS feed. This will automatically import new episodes while skipping any that already exist.
          </p>
          <div className="flex items-center space-x-3">
            <code className="flex-1 bg-ministry-charcoal text-ministry-gold px-3 py-2 rounded text-sm">
              https://manupgodsway.podomatic.com/rss2.xml
            </code>
            <Button
              onClick={handleRSSImport}
              disabled={isImportingRSS}
              className="bg-ministry-charcoal text-white hover:bg-ministry-steel"
              data-testid="button-import-rss"
            >
              {isImportingRSS ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Sync Podcasts
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-ministry-charcoal">Podcast Management</h2>
            <p className="text-ministry-slate">Manage audio and video podcast content</p>
          </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-ministry-gold hover:bg-ministry-gold/90 text-black">
              <Plus className="w-4 h-4 mr-2" />
              New Podcast
            </Button>
          </DialogTrigger>
          <PodcastDialog />
        </Dialog>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <PodcastDialog isEdit />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold"></div>
        </div>
      ) : podcasts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Headphones className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
            <h3 className="text-lg font-medium text-ministry-charcoal mb-2">No Podcasts Yet</h3>
            <p className="text-ministry-slate mb-4">Create your first podcast to get started</p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-ministry-gold hover:bg-ministry-gold/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Podcast
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={podcasts.map((p: Podcast) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {podcasts.map((podcast: Podcast) => (
                <SortablePodcastCard
                  key={podcast.id}
                  podcast={podcast}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      </div>
    </div>
  );
}