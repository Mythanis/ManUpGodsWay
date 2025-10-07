import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PDFData {
  text: string;
  numpages: number;
  info?: any;
  metadata?: any;
  version?: string;
  extractionMethod?: 'text' | 'ocr';
}

interface Study {
  id: string;
  title: string;
  pdfOriginalName?: string;
}

interface UserProgress {
  documentScrollPosition?: number;
}

export default function DocumentViewer() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false);

  // Fetch study details
  const { data: study } = useQuery<Study>({
    queryKey: [`/api/studies/${id}`],
    enabled: !!id,
  });

  // Fetch PDF text
  const { data: pdfData, isLoading: isPdfLoading } = useQuery<PDFData>({
    queryKey: [`/api/studies/${id}/pdf-text`],
    enabled: !!id,
    retry: false,
  });

  // Fetch user progress to get scroll position
  const { data: progress } = useQuery<UserProgress>({
    queryKey: [`/api/progress/${id}`],
    enabled: !!id,
  });

  // Mutation to update scroll position
  const updateScrollMutation = useMutation({
    mutationFn: async (scrollPosition: number) => {
      return apiRequest('PATCH', `/api/progress/${id}/scroll-position`, { scrollPosition });
    },
    onError: (error: any) => {
      console.error('Failed to save reading position:', error);
    },
  });

  // Restore scroll position when data loads
  useEffect(() => {
    if (pdfData && progress && !hasRestoredPosition && contentRef.current) {
      const savedPosition = progress.documentScrollPosition || 0;
      if (savedPosition > 0) {
        setTimeout(() => {
          window.scrollTo({
            top: savedPosition,
            behavior: 'smooth',
          });
        }, 100);
      }
      setHasRestoredPosition(true);
    }
  }, [pdfData, progress, hasRestoredPosition]);

  // Save scroll position periodically
  useEffect(() => {
    if (!pdfData) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      
      // Debounce the save operation
      if (handleScroll.timeout) {
        clearTimeout(handleScroll.timeout);
      }
      
      (handleScroll as any).timeout = setTimeout(() => {
        updateScrollMutation.mutate(scrollPosition);
      }, 1000);
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if ((handleScroll as any).timeout) {
        clearTimeout((handleScroll as any).timeout);
      }
    };
  }, [pdfData]);

  const handleBack = () => {
    navigate(`/studies/${id}`);
  };

  const handleDownload = () => {
    window.open(`/api/studies/${id}/pdf-file`, '_blank');
  };

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-ministry-slate">Study ID not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-ministry-charcoal hover:text-ministry-gold"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Study
          </Button>
          
          {study?.pdfOriginalName && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-ministry-charcoal hover:text-ministry-gold"
              data-testid="button-download-document"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8" ref={contentRef}>
        {isPdfLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="h-12 w-12 animate-spin text-ministry-gold mb-4" />
            <p className="text-ministry-slate font-medium">Extracting document content...</p>
            <p className="text-ministry-slate text-sm mt-2">This may take a moment for image-based PDFs</p>
          </div>
        ) : pdfData?.text && pdfData.text.trim().length > 0 ? (
          <div>
            <h1 className="text-3xl font-bold text-ministry-charcoal mb-6" data-testid="text-document-title">
              {study?.pdfOriginalName || 'Document'}
            </h1>
            
            {pdfData.extractionMethod === 'ocr' && (
              <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-green-700">
                    <strong>OCR Extracted:</strong> This text was extracted from an image-based PDF using optical character recognition.
                  </p>
                </div>
              </div>
            )}
            
            <div className="prose prose-lg max-w-none" data-testid="text-document-content">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed text-gray-800">
                  {pdfData.text}
                </pre>
              </div>
            </div>
            
            {pdfData.numpages && (
              <div className="mt-6 text-sm text-gray-500 text-center">
                {pdfData.numpages} page{pdfData.numpages > 1 ? 's' : ''}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-bold text-ministry-charcoal mb-6">
              {study?.pdfOriginalName || 'Document'}
            </h1>
            
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded">
              <div className="flex">
                <svg className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm text-blue-700">
                    Text extraction failed for this PDF. You can view it in your browser or download it.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <iframe
                src={`/api/studies/${id}/pdf-file`}
                className="w-full"
                style={{ height: 'calc(100vh - 300px)', minHeight: '600px' }}
                title="PDF Document Viewer"
                data-testid="iframe-document-fallback"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
