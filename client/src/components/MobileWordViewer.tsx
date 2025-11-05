import { useState, useEffect } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileWordViewerProps {
  wordHtmlUrl: string;
  wordFileUrl: string;
  studyTitle: string;
  isDocFile: boolean;
  onBack: () => void;
  onDownload: () => void;
}

export default function MobileWordViewer({
  wordHtmlUrl,
  wordFileUrl,
  studyTitle,
  isDocFile,
  onBack,
  onDownload,
}: MobileWordViewerProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
              className="flex-shrink-0"
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

      {/* Document Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {isDocFile ? (
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
              Please download this .doc file to view it, or ask the admin to re-upload it as a .docx file.
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
        ) : (
          <iframe
            src={wordHtmlUrl}
            className="w-full h-full border-0"
            title="Word Document Viewer"
            data-testid="iframe-word-viewer"
          />
        )}
      </div>
    </div>
  );
}
