import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface UserInteractiveWordViewerProps {
  studyId: string;
  wordHtmlUrl: string;
  wordFileUrl: string;
  studyTitle: string;
  isDocFile: boolean;
  onBack: () => void;
  onDownload: () => void;
}

interface EditableSection {
  id: string;
  anchorKey: string;
  label: string;
  displayOrder: number;
  defaultPrompt?: string;
}

interface UserResponse {
  id: string;
  sectionId: string;
  responseText?: string;
}

export default function UserInteractiveWordViewer({
  studyId,
  wordHtmlUrl,
  wordFileUrl,
  studyTitle,
  isDocFile,
  onBack,
  onDownload,
}: UserInteractiveWordViewerProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch editable sections
  const { data: editableSections = [] } = useQuery<EditableSection[]>({
    queryKey: [`/api/studies/${studyId}/editable-sections`],
    enabled: !!studyId && !isDocFile,
  });

  // Fetch user responses
  const { data: userResponses = [] } = useQuery<UserResponse[]>({
    queryKey: [`/api/studies/${studyId}/user-responses`],
    enabled: !!studyId && !isDocFile,
  });

  // Save response mutation with debouncing
  const saveResponseMutation = useMutation({
    mutationFn: async ({ sectionId, responseText }: { sectionId: string; responseText: string }) => {
      return await apiRequest('POST', '/api/user-responses', {
        studyId,
        sectionId,
        responseText,
      });
    },
    onError: (error: any) => {
      console.error('Error saving response:', error);
    }
  });

  // Fetch Word HTML
  useEffect(() => {
    if (isDocFile || !studyId) return;
    
    fetch(wordHtmlUrl)
      .then(res => res.text())
      .then(html => {
        setHtmlContent(html);
      })
      .catch(err => {
        console.error('Error fetching Word HTML:', err);
      });
  }, [studyId, wordHtmlUrl, isDocFile]);

  // Load user responses into state
  useEffect(() => {
    const responsesMap: Record<string, string> = {};
    userResponses.forEach(r => {
      responsesMap[r.sectionId] = r.responseText || '';
    });
    setResponses(responsesMap);
  }, [userResponses]);

  // Check mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Debounced save
  const handleResponseChange = useCallback((sectionId: string, text: string) => {
    setResponses(prev => ({ ...prev, [sectionId]: text }));
    
    // Debounce save - 1 second
    const timeoutId = setTimeout(() => {
      saveResponseMutation.mutate({ sectionId, responseText: text });
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [saveResponseMutation]);

  // Inject textareas into HTML
  useEffect(() => {
    if (!htmlContent || editableSections.length === 0) return;
    
    const container = document.querySelector('[data-testid="interactive-word-content"]');
    if (!container) return;
    
    // Remove old textareas
    container.querySelectorAll('.editable-section-wrapper').forEach(el => el.remove());
    
    // Inject textareas for each editable section
    editableSections
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach(section => {
        try {
          const element = container.querySelector(section.anchorKey);
          if (!element) return;
          
          // Create wrapper for textarea
          const wrapper = document.createElement('div');
          wrapper.className = 'editable-section-wrapper my-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded';
          wrapper.setAttribute('data-section-id', section.id);
          
          // Add label
          const label = document.createElement('div');
          label.className = 'font-medium text-sm text-blue-900 dark:text-blue-100 mb-2';
          label.textContent = section.label;
          wrapper.appendChild(label);
          
          // Create textarea container (React will render into this)
          const textareaContainer = document.createElement('div');
          textareaContainer.setAttribute('data-textarea-id', section.id);
          wrapper.appendChild(textareaContainer);
          
          // Insert after the marked element
          element.after(wrapper);
        } catch (err) {
          console.warn('Could not inject textarea for section:', section.anchorKey);
        }
      });
    
    // Now render textareas using React
    editableSections.forEach(section => {
      const container = document.querySelector(`[data-textarea-id="${section.id}"]`);
      if (!container) return;
      
      // Create textarea element
      const textarea = document.createElement('textarea');
      textarea.className = 'w-full min-h-[100px] p-3 border rounded-md bg-white dark:bg-gray-800 text-foreground';
      textarea.placeholder = section.defaultPrompt || 'Type your response here...';
      textarea.value = responses[section.id] || '';
      textarea.setAttribute('data-testid', `textarea-response-${section.displayOrder}`);
      
      // Add change handler
      textarea.addEventListener('input', (e) => {
        const target = e.target as HTMLTextAreaElement;
        handleResponseChange(section.id, target.value);
      });
      
      container.appendChild(textarea);
    });
  }, [htmlContent, editableSections, responses, handleResponseChange]);

  if (isDocFile) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-base font-semibold truncate text-foreground">
                {studyTitle}
              </h1>
            </div>
            <Button
              variant="outline"
              size={isMobile ? "icon" : "default"}
              onClick={onDownload}
              className="flex-shrink-0 ml-2"
              data-testid="button-download"
            >
              <Download className="w-4 h-4" />
              {!isMobile && <span className="ml-2">Download</span>}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Viewer Not Available for .doc Files
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              The in-browser viewer only works with .docx files (newer Word format). 
              Please download this .doc file to view it.
            </p>
            <Button
              onClick={onDownload}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-download-doc"
            >
              <Download className="w-5 h-5 mr-2" />
              Download File
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-base font-semibold truncate text-foreground">
              {studyTitle}
            </h1>
          </div>
          <Button
            variant="outline"
            size={isMobile ? "icon" : "default"}
            onClick={onDownload}
            className="flex-shrink-0 ml-2"
            data-testid="button-download"
          >
            <Download className="w-4 h-4" />
            {!isMobile && <span className="ml-2">Download</span>}
          </Button>
        </div>
        {editableSections.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-sm text-muted-foreground">
              <Save className="w-4 h-4 inline mr-1" />
              {editableSections.length} editable {editableSections.length === 1 ? 'section' : 'sections'} · Auto-saves as you type
            </p>
          </div>
        )}
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 p-8">
        <div
          className="max-w-3xl mx-auto prose dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          data-testid="interactive-word-content"
        />
      </div>
    </div>
  );
}
