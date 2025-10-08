import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface MobilePdfViewerProps {
  pdfUrl: string;
  studyTitle: string;
  onBack: () => void;
  onDownload: () => void;
}

export default function MobilePdfViewer({ pdfUrl, studyTitle, onBack, onDownload }: MobilePdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    // Set page width to full viewport width minus padding
    setPageWidth(window.innerWidth - 32); // 16px padding on each side
  }, []);

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <Button
              onClick={onBack}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-gray-800"
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-white font-medium text-sm truncate" data-testid="text-study-title">
              {studyTitle}
            </h1>
          </div>
          <Button
            onClick={onDownload}
            size="sm"
            className="bg-ministry-gold text-black hover:bg-ministry-gold/90 ml-2"
            data-testid="button-download-pdf"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="px-4 py-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-ministry-gold animate-spin mb-4" />
            <p className="text-white text-sm">Loading document...</p>
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="flex flex-col space-y-4"
        >
          {Array.from(new Array(numPages), (_, index) => (
            <div key={`page_${index + 1}`} className="bg-white shadow-lg">
              <Page
                pageNumber={index + 1}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="w-full"
                loading={
                  <div className="flex items-center justify-center py-10 bg-gray-100">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                }
              />
            </div>
          ))}
        </Document>

        {!isLoading && numPages > 0 && (
          <div className="text-center py-6">
            <p className="text-gray-400 text-sm" data-testid="text-page-count">
              {numPages} {numPages === 1 ? 'page' : 'pages'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
