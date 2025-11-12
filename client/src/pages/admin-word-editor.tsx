import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Study {
  id: string;
  title: string;
  wordOriginalName?: string;
}

interface EditableSection {
  id?: string;
  anchorKey: string;
  label: string;
  displayOrder: number;
  defaultPrompt?: string;
}

export default function AdminWordEditor() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [htmlContent, setHtmlContent] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ anchorKey: string; text: string } | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    defaultPrompt: '',
    displayOrder: 0
  });

  // Fetch study details
  const { data: study } = useQuery<Study>({
    queryKey: [`/api/studies/${id}`],
    enabled: !!id,
  });

  // Fetch existing editable sections
  const { data: editableSections = [], refetch: refetchSections } = useQuery<EditableSection[]>({
    queryKey: [`/api/studies/${id}/editable-sections`],
    enabled: !!id,
  });

  // Fetch Word HTML
  useEffect(() => {
    if (!id) return;
    
    fetch(`/api/studies/${id}/word-html`)
      .then(res => res.text())
      .then(html => {
        setHtmlContent(html);
      })
      .catch(err => {
        console.error('Error fetching Word HTML:', err);
        toast({
          title: 'Error',
          description: 'Failed to load Word document',
          variant: 'destructive'
        });
      });
  }, [id, toast]);

  // Highlight existing editable sections
  useEffect(() => {
    if (!htmlContent || editableSections.length === 0) return;
    
    const container = document.querySelector('[data-testid="word-content"]');
    if (!container) return;
    
    // Remove old highlights
    container.querySelectorAll('.editable-section-highlight').forEach(el => {
      el.classList.remove('editable-section-highlight');
      el.removeAttribute('data-section-id');
    });
    
    // Add highlights for existing sections
    editableSections.forEach(section => {
      try {
        const element = container.querySelector(section.anchorKey);
        if (element) {
          element.classList.add('editable-section-highlight');
          element.setAttribute('data-section-id', section.id || '');
        }
      } catch (err) {
        console.warn('Could not find element for anchor:', section.anchorKey);
      }
    });
  }, [htmlContent, editableSections]);

  // Mutation to create editable section
  const createSectionMutation = useMutation({
    mutationFn: async (data: Omit<EditableSection, 'id'>) => {
      return await apiRequest('POST', `/api/studies/${id}/editable-sections`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Editable section created',
      });
      refetchSections();
      setShowDialog(false);
      setFormData({ label: '', defaultPrompt: '', displayOrder: editableSections.length });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create section',
        variant: 'destructive'
      });
    }
  });

  // Mutation to delete editable section
  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      return await apiRequest('DELETE', `/api/editable-sections/${sectionId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Editable section deleted',
      });
      refetchSections();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete section',
        variant: 'destructive'
      });
    }
  });

  // Generate DOM path for an element relative to container
  const getDomPath = (element: Element, container: Element): string => {
    const path: string[] = [];
    let current: Element | null = element;
    
    // Build path from element up to (but not including) the container
    while (current && current !== container) {
      const parent: Element | null = current.parentElement;
      if (!parent || parent === container || !container.contains(current)) {
        // Add the final segment and break
        const siblings = Array.from((parent || container).children).filter(
          (child): child is Element => child.tagName === current!.tagName
        );
        const index = siblings.indexOf(current);
        path.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index + 1})`);
        break;
      }
      
      const siblings = Array.from(parent.children).filter(
        (child): child is Element => child.tagName === current!.tagName
      );
      const index = siblings.indexOf(current);
      path.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index + 1})`);
      current = parent;
    }
    
    return ':scope > ' + path.join(' > ');
  };

  // Handle clicking on a paragraph
  const handleElementClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Find the container
    const container = document.querySelector('[data-testid="word-content"]');
    if (!container) return;
    
    // Find the closest paragraph or heading
    const element = target.closest('p, h1, h2, h3, h4, h5, h6');
    if (!element) return;
    
    // Generate stable DOM-based anchor key relative to container
    const anchorKey = getDomPath(element, container);
    
    // Check if this section already exists
    const existingSection = editableSections.find(s => s.anchorKey === anchorKey);
    if (existingSection) {
      toast({
        title: 'Already Marked',
        description: 'This section is already marked as editable',
      });
      return;
    }
    
    const text = element.textContent || '';
    if (text.trim().length === 0) return;
    
    setSelectedElement({ anchorKey, text: text.slice(0, 100) });
    setFormData({
      label: text.slice(0, 50),
      defaultPrompt: '',
      displayOrder: editableSections.length
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!selectedElement) return;
    
    createSectionMutation.mutate({
      anchorKey: selectedElement.anchorKey,
      label: formData.label,
      displayOrder: formData.displayOrder,
      defaultPrompt: formData.defaultPrompt || undefined
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <style>{`
        .editable-section-highlight {
          background-color: rgba(59, 130, 246, 0.1);
          border-left: 3px solid #3b82f6;
          padding-left: 8px;
          cursor: not-allowed;
        }
        .editable-section-highlight:hover {
          background-color: rgba(59, 130, 246, 0.2);
        }
      `}</style>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              Mark Editable Sections
            </h1>
          </div>
        </div>
        <div className="px-4 pb-3">
          <p className="text-sm text-muted-foreground">
            Click on any paragraph or heading to mark it as an editable section for users
          </p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Document Preview */}
        <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 p-8">
          <div 
            className="max-w-3xl mx-auto prose dark:prose-invert cursor-pointer"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            onClick={handleElementClick}
            data-testid="word-content"
          />
        </div>

        {/* Editable Sections Sidebar */}
        <div className="w-80 border-l border-border bg-background overflow-auto">
          <div className="p-4">
            <h2 className="font-semibold text-lg mb-4">Editable Sections ({editableSections.length})</h2>
            
            {editableSections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No editable sections yet. Click on the document to add some.
              </p>
            ) : (
              <div className="space-y-2">
                {editableSections.map((section, index) => (
                  <div
                    key={section.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{section.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Order: {section.displayOrder}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => section.id && deleteSectionMutation.mutate(section.id)}
                        data-testid={`button-delete-section-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Section Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Section as Editable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedElement && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                <p className="text-xs text-muted-foreground mb-1">Selected text:</p>
                <p className="text-sm">{selectedElement.text}...</p>
              </div>
            )}
            
            <div>
              <Label htmlFor="label">Section Label</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Reflection Question 1"
                data-testid="input-section-label"
              />
            </div>
            
            <div>
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-display-order"
              />
            </div>
            
            <div>
              <Label htmlFor="defaultPrompt">Default Prompt (Optional)</Label>
              <Textarea
                id="defaultPrompt"
                value={formData.defaultPrompt}
                onChange={(e) => setFormData({ ...formData, defaultPrompt: e.target.value })}
                placeholder="e.g., Write your thoughts here..."
                rows={3}
                data-testid="textarea-default-prompt"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.label.trim() || createSectionMutation.isPending}
              data-testid="button-save-section"
            >
              {createSectionMutation.isPending ? 'Saving...' : 'Save Section'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
