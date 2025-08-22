import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, X, Plus, Heart, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Testimony } from "@shared/schema";

interface TestimonyFormProps {
  userId?: string;
  isOwnProfile?: boolean;
}

export function TestimonyForm({ userId, isOwnProfile = false }: TestimonyFormProps) {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [faithJourneyStage, setFaithJourneyStage] = useState("beginning");
  const [isEditing, setIsEditing] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch existing testimony
  const { data: testimony, isLoading } = useQuery<Testimony | null>({
    queryKey: [`/api/testimony${userId && !isOwnProfile ? `/${userId}` : ''}`],
    retry: false,
  });

  // Set form data when testimony loads
  useEffect(() => {
    if (testimony) {
      setContent(testimony.content || "");
      setTags(testimony.tags || []);
      setIsPublic(testimony.isPublic || false);
      setFaithJourneyStage(testimony.faithJourneyStage || "beginning");
    }
  }, [testimony]);

  // Save testimony mutation
  const saveTestimonyMutation = useMutation({
    mutationFn: async (testimonyData: { content: string; tags: string[]; isPublic: boolean; faithJourneyStage: string }) => {
      const response = await fetch('/api/testimony', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(testimonyData)
      });
      if (!response.ok) throw new Error('Failed to save testimony');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate testimony queries
      queryClient.invalidateQueries({ queryKey: [`/api/testimony`] });
      // Invalidate discipleship page data
      queryClient.invalidateQueries({ queryKey: ['/api/users-with-testimonies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/testimony-tags'] });
      setIsEditing(false);
      toast({
        title: "Testimony saved",
        description: "Your testimony has been saved successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save testimony. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete testimony mutation
  const deleteTestimonyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/testimony', {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete testimony');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate testimony queries
      queryClient.invalidateQueries({ queryKey: [`/api/testimony`] });
      // Invalidate discipleship page data
      queryClient.invalidateQueries({ queryKey: ['/api/users-with-testimonies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/testimony-tags'] });
      setContent("");
      setTags([]);
      setIsPublic(false);
      setFaithJourneyStage("beginning");
      setIsEditing(false);
      toast({
        title: "Testimony deleted",
        description: "Your testimony has been deleted."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete testimony. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 10) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    if (!content.trim()) {
      toast({
        title: "Content required",
        description: "Please write your testimony before saving.",
        variant: "destructive"
      });
      return;
    }

    saveTestimonyMutation.mutate({
      content: content.trim(),
      tags,
      isPublic,
      faithJourneyStage
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // If viewing another user's profile and no public testimony
  if (!isOwnProfile && (!testimony || !testimony.isPublic)) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-ministry-slate">
            <Heart className="w-12 h-12 mx-auto mb-4 text-ministry-slate/50" />
            <p>This user hasn't shared their testimony publicly</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If viewing another user's public testimony
  if (!isOwnProfile && testimony && testimony.isPublic) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-ministry-gold" />
            <span>Testimony</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-sm max-w-none">
            <p className="text-white leading-relaxed whitespace-pre-wrap">{testimony.content}</p>
          </div>
          
          {testimony.tags && testimony.tags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Tags</Label>
              <div className="flex flex-wrap gap-2">
                {testimony.tags.map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="bg-ministry-gold-exact/20 text-ministry-charcoal border-ministry-gold"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-xs text-white">
            Shared on {new Date(testimony.createdAt).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Own profile view
  if (!testimony && !isEditing) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Heart className="w-12 h-12 mx-auto mb-4 text-ministry-slate/50" />
            <h3 className="text-lg font-semibold text-white mb-2">Share Your Testimony</h3>
            <p className="text-white mb-4">
              Share your faith journey and inspire others with your testimony of God's work in your life.
            </p>
            <Button 
              onClick={() => setIsEditing(true)}
              className="bg-ministry-navy text-white hover:bg-ministry-charcoal"
              data-testid="button-create-testimony"
            >
              <Plus className="w-4 h-4 mr-2" />
              Write Testimony
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-ministry-gold" />
            <span>Your Testimony</span>
          </div>
          {!isEditing && testimony && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-testimony"
            >
              Edit
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isEditing ? (
          <>
            {/* Testimony Content */}
            <div className="space-y-2">
              <Label htmlFor="testimony-content" className="text-white">Your Testimony</Label>
              <Textarea
                id="testimony-content"
                placeholder="Share your faith journey, how God has worked in your life, moments of transformation, answered prayers, or any testimony of His goodness..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] resize-none"
                data-testid="textarea-testimony-content"
              />
              <div className="text-xs text-white">
                {content.length} characters • No limit
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="testimony-tags" className="text-white">Tags (Optional)</Label>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                    id="testimony-tags"
                    placeholder="Add a tag (e.g., salvation, healing, breakthrough)"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                    data-testid="input-testimony-tag"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleAddTag}
                    disabled={!newTag.trim() || tags.includes(newTag.trim()) || tags.length >= 10}
                    data-testid="button-add-tag"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className="bg-ministry-gold-exact/20 text-ministry-charcoal border-ministry-gold cursor-pointer hover:bg-ministry-gold-exact/30"
                        onClick={() => handleRemoveTag(tag)}
                        data-testid={`tag-${tag}`}
                      >
                        {tag}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="text-xs text-white">
                  {tags.length}/10 tags • Click tags to remove them
                </div>
              </div>
            </div>

            {/* Faith Journey Stage */}
            <div className="space-y-2">
              <Label htmlFor="faith-journey-stage" className="text-white">Where are you in your faith journey?</Label>
              <Select value={faithJourneyStage} onValueChange={setFaithJourneyStage}>
                <SelectTrigger data-testid="select-faith-journey-stage">
                  <SelectValue placeholder="Select your faith stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginning">Just beginning my walk in faith</SelectItem>
                  <SelectItem value="middle">In the middle of my faith, still going through transformation</SelectItem>
                  <SelectItem value="mature">Mature in my faith, steady in God's love and mercy</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-white">
                This helps others connect with testimonies that relate to their own journey.
              </div>
            </div>

            {/* Privacy Setting */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Privacy Setting</Label>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {isPublic ? (
                    <Eye className="w-4 h-4 text-ministry-navy" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-ministry-slate" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {isPublic ? "Public" : "Private"}
                    </p>
                    <p className="text-xs text-white">
                      {isPublic 
                        ? "Visible on your profile to other community members" 
                        : "Only visible to you"
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  data-testid="switch-testimony-public"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button 
                onClick={handleSave}
                disabled={saveTestimonyMutation.isPending}
                className="bg-ministry-navy text-white hover:bg-ministry-charcoal"
                data-testid="button-save-testimony"
              >
                {saveTestimonyMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Testimony
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  // Reset to original values
                  if (testimony) {
                    setContent(testimony.content || "");
                    setTags(testimony.tags || []);
                    setIsPublic(testimony.isPublic || false);
                    setFaithJourneyStage(testimony.faithJourneyStage || "beginning");
                  }
                }}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>

              {testimony && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    if (confirm("Are you sure you want to delete your testimony? This action cannot be undone.")) {
                      deleteTestimonyMutation.mutate();
                    }
                  }}
                  disabled={deleteTestimonyMutation.isPending}
                  data-testid="button-delete-testimony"
                >
                  {deleteTestimonyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Display Mode */}
            <div className="prose prose-sm max-w-none">
              <p className="text-white leading-relaxed whitespace-pre-wrap">{testimony.content}</p>
            </div>
            
            {testimony.tags && testimony.tags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white">Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {testimony.tags.map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="bg-ministry-gold-exact/20 text-ministry-charcoal border-ministry-gold"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-2 text-xs text-white">
                {testimony.isPublic ? (
                  <>
                    <Eye className="w-3 h-3" />
                    <span>Public</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3" />
                    <span>Private</span>
                  </>
                )}
              </div>
              <div className="text-xs text-white">
                Last updated {new Date(testimony.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}